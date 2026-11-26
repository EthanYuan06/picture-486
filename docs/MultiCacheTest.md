# MultiCacheTest — 公共图库首页两级缓存并发实测记录

结论先放这儿：50 并发打同一个分页查询，走缓存比全部穿透到数据库快 4.6 倍（平均 272.8ms → 59.8ms），P95 快 4.2 倍。同一个接口在串行口径下只有 2.15 倍。差在哪、为什么差、这个数能不能对外说，下面按「口径 → 基线 → 改了什么 → 代价」四段记清楚。

| 项 | 值 |
| --- | --- |
| 记录时间 | 2026-11-26 |
| 被测接口 | `POST /api/picture/list/page/vo`（公共图库主页第一页，`pageSize=20`） |
| 缓存结构 | L1 Caffeine（进程内）+ L2 Redis（分布式），Cache-Aside |
| 用例 | `src/test/java/com/yuluo/picture486backend/PictureCacheConcurrencyPerformanceTest.java` |
| 运行命令 | `mvn test -Dtest=PictureCacheConcurrencyPerformanceTest` |
| 规模 | 每场景 50 并发 × 5 波 = 250 请求，共两轮 |
| 环境 | Windows 本机 / Spring Boot 3.5.6 / Java 21 虚拟线程 / MySQL(486_picture, dev) / 单机 Redis / 单应用实例 |

## 一、口径是什么

测的是接口的端到端响应时间，从客户端发出请求到读完响应体，用 `System.nanoTime()` 包住 `TestRestTemplate.exchange` 调用。不是 MyBatis 的 SQL 执行时间，也不是数据库耗时，里面包含 Spring MVC 拦截器、Sa-Token 鉴权、JSON 序列化、Redis 往返和连接池排队。

查询条件固定为公共图库主页：`spaceId=null`，服务端会把它改写成 `spaceId IS NULL AND reviewStatus=1`。整个用例只登录一次并复用同一个管理员会话，因为缓存 key 是 `listPageVo:` + 请求对象 JSON 的 MD5，而服务端在算 MD5 之前会先改写请求对象——会话不同、登录用户不同都会算出不同 key，那样两组数据就没有可比性了。

并发不是泊松到达，是起跑门模型：50 个线程全部阻塞在同一个 `CountDownLatch` 上，主线程 `countDown()` 后同一瞬间散开。这是刻意选的，模拟首页缓存集体失效那一刻的冲击，而不是稳态流量。分位数取五波 250 个样本合并排序后按 `ceil(p·n/100)-1` 取值，不用「波均值的均值」，免得被小样本波带偏。QPS 是单波 50 请求除以该波墙钟时间。

路径是靠两端证据确认的，不是靠「我猜它命中了」：未命中波开始前调 `/picture/cache/stats` 断言 `l2ListPageVoKeys == 0`，波结束后断言它变成 1；同时用日志里的 SQL 条数交叉核对。

这里有个必须写下来的口径缺口。起跑门做不到物理意义上的绝对同时，加上第一个请求返回就会回写缓存，所以「未命中」这一组里混进了提前命中的请求。第二轮日志里 `SELECT COUNT(*) AS total FROM picture` 只出现 176 次（含 1 次预热），也就是说 250 个请求里约 175 个真穿透、约 75 个提前命中了；第一轮是 195 次，穿透比例约 78%。扣掉混入的命中样本外推，纯穿透的平均耗时约 370ms，对应提升约 6 倍。**这条外推是估算，不是实测**，对外引用时用实测的 4.6 倍更安全，它偏低但可复现。

## 二、基线是多少

两个口径的数并列，不能互相替换。

| 口径 | 无缓存 | L2 命中 | L1 命中 | 提升 |
| --- | --- | --- | --- | --- |
| 串行（`jmeter/cache_perf_test.py`，并发=1，各 30 次） | 51.95ms | 31.29ms | 24.13ms | 2.15× |
| 并发第一轮（本次，50×5） | 212.1ms | — | 40.9ms | 5.2×（P95 4.8×） |
| 并发第二轮（本次，50×5） | 272.8ms | — | 59.8ms | 4.6×（P95 4.2×） |

简历上「首页接口响应最高提升 2.15 倍」就是串行那条线的数，出处是 `jmeter/cache_test_results/summary.json`。串行口径下无缓存约 52ms，是数据库本身的开销；并发口径下同一条件涨到 212~273ms，多出来的时间几乎都在排队——HikariCP 默认最大 10 个连接，50 个请求同时穿透时后面 40 个在等连接。这一段排队成本是串行测不出来的，也正是并发场景下缓存收益被放大的原因。

波动也要写清楚：两轮的整体提升是 4.6× 和 5.2×，同一轮内五波之间差异更大，第二轮无缓存五波依次是 603 / 362 / 180 / 108 / 112ms，越往后越快，是数据库缓冲池和 JIT 变热的结果；走缓存那组的第五波反而从 40ms 跳到 140ms，属于 GC 或调度噪声。所以引用倍数时要说明样本来自多波合并，单拿一波讲结论会被问倒。

## 三、我做了什么导致变化

被测的改动本身是既有的两级缓存，读写路径内联在 `PictureController.listPictureVoByPage`：先查 L1，未命中查 L2 并回填 L1，再未命中查数据库并回填两层。L1 是 `Caffeine` 实例，`initialCapacity=1024`、`maximumSize=10000`、`expireAfterWrite` 取 1~3 分钟的随机值；L2 是 `StringRedisTemplate`，同一 key 每次写入时随机取 3~5 分钟 TTL。TTL 随机的目的是打散过期时间，避免整批 key 同一刻集体失效——第二轮数据里那种「击穿后越跑越快」的形态，恰好是这套设计要防的场面。缓存里存的是 `Page<Picture>` 的 JSON 字符串，不是 VO，也不是 ID 列表。

我这次为「让变化可测量」做的事有四件：一是把 `jmeter` 的串行脚本改写成 JUnit 用例，用起跑门把它变成并发测量；二是按波清缓存并断言，保证「无缓存」是真无缓存；三是走缓存场景每波前补一次串行预热，因为 L1 的随机 TTL 是在 Bean 构造时用一次 `ThreadLocalRandom` 取定的（`nextLong(1, 4)` 在 `Caffeine.newBuilder()` 链上求值，不是每条写入重新取），一份实例上这个过期时间是固定的，长测试里后几波可能已经悄悄退化到 L2 甚至数据库；四是把测试上下文的 Redis 连接工厂换成 Lettuce，原因见附录，这条直接决定了「测出的 Redis 往返不是线上那个客户端」。

## 四、代价和副作用是什么

命中不等于不查库。缓存里放的是 `Page<Picture>`，VO 装配发生在缓存读取之后：`getPictureVoPage` 会拿这一页的 userId 集合去 `SELECT ... FROM user WHERE id IN (?)`，日志里 500 个成功请求对应 506 次该查询（多出 6 次是预热）。再叠加 Sa-Token 的 `getLoginUser` 每次请求都按 id 回查一次用户表，单次命中固定两条 SQL。这就是走缓存那一组仍有 40ms 地板的原因——它不是噪声，是设计边界。要继续压，得把用户信息也缓存住，或者直接缓存 VO。

没有并发保护。未命中路径上没有互斥、没有 `setIfAbsent` 单飞，同一个 key 失效瞬间 50 个请求会全量穿透到数据库，日志里一轮出现过 1121ms 的 max。缓解方向是「热 key 逻辑过期 + 单线程回源」或者请求合并，但代价是要接受短暂返回旧数据。

一致性靠全量失效。所有写操作（上传、编辑、审核、批量审核、AI 回调）都调 `clearCache(prefix)`，实现是 `LOCAL_CACHE.invalidateAll()` 加 `delete(keys(prefix + "*"))`。两个问题：一是任何一次上传都会清空整个前缀下的所有分页缓存，写多的场景命中率会被反复打穿；二是 `keys()` 是阻塞式全量扫描，数据量上去以后这个调用本身就是一次故障源，应该换 `SCAN`。

L1 有两处代码层面的疏漏值得记一笔，面试被问到「你的缓存有什么做得不好的地方」时可以主动讲：注释写的是「随机 1~3 分钟移除」，但随机值只在构造时取一次，实际效果是全局固定 TTL，起不到打散作用；另外回填缓存时算了一个 `localCacheTtl` 变量但从未使用。

还有内存与序列化成本。每个缓存条目是整页 JSON 字符串，`maximumSize=10000` 只是条数上限不是字节上限，页大时内存不可控；每次命中都要用 hutool 反序列化重建 `Page<Picture>`，日期字段按默认规则还原，这部分 CPU 开销串行测出来只有零点几毫秒，并发时才显形。

最后是这组数据本身不能代表什么：本机回环没有真实网络 RTT；单实例部署时 L1 命中率接近 100%，多实例下每台机器各自一份 L1，命中率会明显低于这里；测试当时为了绕过 Redisson 兼容缺陷在测试上下文换成了 Lettuce 工厂，与当时的线上配置不一致——该缺陷现已根治（见附录），现在测试与线上统一走 Lettuce；数据规模是本机 dev 库的公共图库全量过审数据，与线上量级不同。这几个限定条件任何一个变了，倍数都要重测。

## 五、面试追问预案

**「4.6 倍怎么算出来的？」** 同一接口、同一查询条件、同一登录会话，两组各 250 个请求（50 并发 × 5 波）的均值对比，未命中组 272.8ms，命中组 59.8ms。不是单次取样，也不是我自己写的计时打点，是客户端侧端到端时间。

**「简历里写 2.15 倍，这里又 4.6 倍，哪个是真的？」** 都是真的，口径不同。2.15 倍是串行单请求（52ms → 24ms），只反映数据库查询本身被省掉；4.6 倍是 50 并发下的结果，多出来的收益来自躲开连接池排队。对外我用 2.15 这个保守值，被追问再补并发口径的数。

**「怎么证明那一组真的没走缓存？」** 两端证据：波前波后调缓存状态接口，Redis 的 `listPageVo` key 数从 0 变 1；同时统计日志里 picture 表的分页 SQL 次数。顺带我会主动说破——那一轮 250 个请求只出现 176 次 count 查询，因为起跑门做不到绝对同时，约三成请求在首个请求回写后就命中了，所以实测倍数其实是偏低的一侧。

**「缓存击穿你们怎么处理的？」** 没处理。当前只有 TTL 随机化防雪崩，击穿没有互斥，实测同一 key 会全量穿透，max 冲到 1.1 秒。可接受的原因是公共图库是读多写少、首页热 key 数量有限；要改的话是 `setIfAbsent` 抢锁回源加逻辑过期，或者把回源请求合并。

**「一致性怎么保证？」** 写后全量失效，属于典型的 Cache-Aside 简化实现，牺牲命中率换实现简单。代价是 `KEYS` 阻塞扫描和一次上传清空所有分页缓存，改法是 `SCAN` + 只失效受影响前缀，或者引入版本号。

**「命中了为什么还有 40ms？」** 因为缓存只覆盖了图片分页查询，VO 装配的用户表查询和 Sa-Token 的用户回查还在。这两条 SQL 我用日志数出来了：500 次成功请求对应 506 次用户批量查询和 527 次单条回查。再优化就是用户信息本地缓存或者缓存 VO 结果。

**「为什么用 Redis 还额外加 Caffeine？」** Redis 是跨实例共享的，冷实例也能命中，但每次有网络往返和序列化；Caffeine 挡住最热的翻页流量，把 Redis 往返也省掉。实测这条链上 L1 相对 L2 的收益在串行口径下是 31ms → 24ms，量级不大但叠在首页 QPS 上值得。

**「这组数据有什么地方不能信？」** 我会主动列三条：单实例所以 L1 命中率虚高；本机回环没有网络抖动；测试当时用的是测试上下文里临时换上的 Lettuce 工厂，因为线上那套 Redisson starter 版本与 spring-data-redis 有兼容问题（见附录，该问题已根治，现在测试与线上统一走 Lettuce）。

## 附录 / 待办

**缺陷（已处理，2026-11-26）：Redisson 3.23.5 与 spring-data-redis 3.5.4 不兼容，导致登录接口 500。** 现象是任何 `redisTemplate.expire(key, Duration)` 调用抛 `StackOverflowError`，栈顶在 `DefaultedRedisConnection.pExpire` 反复自调用；根因是 `redisson-spring-boot-starter` 注册的 `RedissonConnectionFactory` 顶掉了 Lettuce 成为默认连接工厂，而 Redisson 3.23.5 的 spring-data 适配层没有覆盖 Spring Data Redis 3.5 新增的 `pExpire(byte[], long, ExpirationOptions$Condition)` 默认方法，默认方法之间形成无限递归。诊断证据（临时用例实测）：`set(key, value, 30, TimeUnit.SECONDS)` 正常、`set(key, value, Duration)` 正常、`expire(key, Duration)` 崩溃。影响面是 Sa-Token 会话写入即触发，登录必然失败；图片缓存自身的 `set(..., ttl, unit)` 不受影响。

处理（最终方案）：不去升级 starter 对齐版本矩阵，而是把 `redisson-spring-boot-starter` 直接换成裸包 `org.redisson:redisson`（版本保持 3.23.5），由新增的 `RedissonConfig` 手动装配 `RedissonClient`（复用 `spring.redisson.config` 的 YAML，`Config.fromYAML` 解析）。这样 spring-data 适配层从 classpath 上整个消失，连接工厂自然回到 Spring Boot 默认的 Lettuce，Sa-Token 登录链路不再经过任何 Redisson 代码；Redisson 仅剩 `SpaceApplicationServiceImpl` 的分布式锁在用，锁 API 与版本适配无关。测试类里的 `@TestConfiguration` Lettuce 绕过已同步删除，测试与线上统一走 Lettuce。回归项：登录接口 200、相册创建 `redissonClient.getLock` 正常、性能测试可复跑。

**其他待办**：`clearCache` 的 `KEYS` 换 `SCAN`；未命中路径加互斥回源；把用户信息或 VO 结果纳入缓存以压掉那 40ms 地板；修正 `PictureController` 里 L1 随机 TTL 未生效与 `localCacheTtl` 未使用这两处。

**复现**：本机启动 MySQL 与 Redis 后执行 `mvn test -Dtest=PictureCacheConcurrencyPerformanceTest`；调规模用 `-Dcache.test.concurrency=20 -Dcache.test.waves=3`。
