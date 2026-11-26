package com.yuluo.picture486backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 多级缓存（L1 Caffeine + L2 Redis）对公共图库主页分页接口的并发性能验证。
 *
 * <p>被测路径为 {@code POST /api/picture/list/page/vo} 中内联的 L1 -> L2 -> DB 逐级穿透逻辑。
 * 采用 RANDOM_PORT 真实 HTTP 调用，使拦截器、序列化、数据库、Redis 的开销都计入耗时，
 * 结论才代表线上真实表现；纯内存 Mock 调用会明显低估缓存收益。</p>
 *
 * <p>两个场景各执行「并发数 x 波数」个请求，请求体与登录态完全一致，
 * 服务端算出的 MD5 缓存 key 相同，两组数据可直接对比：</p>
 * <ul>
 *   <li>不走缓存：每波前调用 {@code /picture/cache/clear-all} 清空两级缓存，再用起跑门让所有线程
 *       同一瞬间发出相同查询，复现「缓存集体失效 -> 并发同时打 DB」的击穿开销；</li>
 *   <li>走缓存：预热后连续并发，全部命中 L1。</li>
 * </ul>
 *
 * <p>运行前提：本地 MySQL(486_picture) 与 Redis(6379) 可访问，且存在管理员账号；依赖不可用时用例
 * 以 skip 结束而不是误报失败。规模可用 JVM 参数覆盖：{@code -Dcache.test.concurrency=50 -Dcache.test.waves=5}。</p>
 */
@Slf4j
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "websocket.enabled=false",
        "ai.description.mq.enabled=false",
        // RabbitMQConfig 显式声明依赖 ConnectionFactory 的 bean，排除 Rabbit 自动装配会导致上下文启动失败；
        // 这里保留自动装配但关掉监听容器自启，使性能测试不受 MQ 可用性影响
        "spring.rabbitmq.listener.simple.auto-startup=false"
})
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PictureCacheConcurrencyPerformanceTest {

    /**
     * 单波并发线程数，量级对齐 JMeter 脚本且保证整体能在数分钟内跑完
     */
    private static final int CONCURRENCY = Integer.getInteger("cache.test.concurrency", 50);

    /**
     * 每个场景的波数，多波合并样本可降低单波抖动对结论的影响
     */
    private static final int WAVES = Integer.getInteger("cache.test.waves", 5);

    /**
     * 公共图库主页第一页；接口有反爬限制，pageSize 不能超过 20
     */
    private static final String QUERY_BODY = "{\"current\":1,\"pageSize\":20,\"spaceId\":null}";

    private static final String ADMIN_ACCOUNT = System.getProperty("cache.test.account", "nina1024");

    private static final String ADMIN_PASSWORD = System.getProperty("cache.test.password", "Nina1024");

    private static final long WAVE_TIMEOUT_SECONDS = 90L;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private TestRestTemplate rest;

    @LocalServerPort
    private int port;

    private String apiBase;

    /**
     * 并发请求共用同一登录态，这是「所有请求命中同一个缓存 key」的前提，因此整个用例只登录一次
     */
    private HttpHeaders authHeaders;

    private ExecutorService workerPool;

    @BeforeAll
    void setUp() throws Exception {
        apiBase = "http://localhost:" + port + "/api";
        // TestRestTemplate 默认不限时，单个请求卡住会拖垮整波统计，故显式设连接/读取超时
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));
        rest.getRestTemplate().setRequestFactory(requestFactory);
        workerPool = Executors.newFixedThreadPool(CONCURRENCY);
        authHeaders = loginAsAdmin();
    }

    @AfterAll
    void tearDown() {
        if (workerPool != null) {
            workerPool.shutdownNow();
        }
        // 清掉测试期间写入的两级缓存，避免污染手工验证与其它用例
        try {
            requestData(HttpMethod.POST, "/picture/cache/clear-all");
        } catch (Exception | AssertionError e) {
            log.warn("[缓存测试] 收尾清理缓存失败，可手工调用 /picture/cache/clear-all: {}", e.getMessage());
        }
    }

    @Test
    void compareCacheHitWithCacheMissUnderConcurrency() throws Exception {
        log.info("========== 多级缓存并发性能测试开始：{} 并发 x {} 波/场景 ==========", CONCURRENCY, WAVES);

        // 先跑一次丢弃请求，把 HTTP 客户端建连、Sa-Token 首次校验、JIT 冷启动开销排除在统计之外
        warmUp();

        List<Long> missLatencies = new ArrayList<>();
        List<Long> hitLatencies = new ArrayList<>();
        for (int wave = 1; wave <= WAVES; wave++) {
            missLatencies.addAll(runMissWave(wave));
        }
        for (int wave = 1; wave <= WAVES; wave++) {
            hitLatencies.addAll(runHitWave(wave));
        }

        report(missLatencies, hitLatencies);
    }

    /**
     * 未命中场景：清空两级缓存 -> 断言确实为空 -> 并发同瞬间打同一 key -> 断言缓存被重新回填
     */
    private List<Long> runMissWave(int wave) throws Exception {
        clearAllCache();
        assertEquals(0L, cacheStats().path("l2ListPageVoKeys").asLong(),
                "本波开始前 Redis 不应存在 listPageVo 缓存，否则测到的不是 DB 路径");

        WaveResult result = runWave();
        assertTrue(result.failed() == 0, "未命中波存在失败请求，无法证明并发穿透路径");
        assertEquals(1L, cacheStats().path("l2ListPageVoKeys").asLong(), "并发未命中后同一 key 只应回填一条 Redis 缓存");

        log.info("[无缓存] 第{}波: 并发={}, 成功={}/{}, avg={}ms, P50={}ms, P95={}ms, P99={}ms, max={}ms, QPS={}",
                wave, CONCURRENCY, result.ok(), CONCURRENCY, fmt(result.stats().avgMs()), fmt(result.stats().minMs()),
                fmt(result.stats().p50Ms()), fmt(result.stats().p95Ms()), fmt(result.stats().maxMs()), fmt(result.stats().qps()));
        return result.latenciesMs();
    }

    /**
     * 命中场景：每波前补一次串行预热
     *
     * <p>Controller 中 Caffeine 的 expireAfterWrite 是在 Bean 构造时用随机数取定的一次性值（1~4 分钟），
     * 一旦某波开始前 L1 恰好过期，该波会静默退化到 L2 甚至 DB，「走缓存」的数据就失真了。</p>
     */
    private List<Long> runHitWave(int wave) throws Exception {
        warmUp();
        assertTrue(cacheStats().path("l2ListPageVoKeys").asLong() >= 1L,
                "预热后 Redis 应存在 listPageVo 缓存，否则测不到命中路径");

        WaveResult result = runWave();
        assertTrue(result.failed() == 0, "命中波存在失败请求");

        log.info("[走缓存] 第{}波: 并发={}, 成功={}/{}, avg={}ms, P50={}ms, P95={}ms, P99={}ms, max={}ms, QPS={}",
                wave, CONCURRENCY, result.ok(), CONCURRENCY, fmt(result.stats().avgMs()), fmt(result.stats().minMs()),
                fmt(result.stats().p50Ms()), fmt(result.stats().p95Ms()), fmt(result.stats().maxMs()), fmt(result.stats().qps()));
        return result.latenciesMs();
    }

    /**
     * 起跑门发压：所有线程阻塞在同一个闩上，countDown 后同一瞬间发出请求
     */
    private WaveResult runWave() throws InterruptedException, java.util.concurrent.ExecutionException,
            java.util.concurrent.TimeoutException {
        CountDownLatch gate = new CountDownLatch(1);
        ConcurrentLinkedQueue<String> errors = new ConcurrentLinkedQueue<>();
        List<Future<Long>> futures = new ArrayList<>(CONCURRENCY);
        for (int i = 0; i < CONCURRENCY; i++) {
            futures.add(workerPool.submit(() -> {
                gate.await();
                return timedRequest(errors);
            }));
        }

        long wallStart = System.nanoTime();
        gate.countDown();

        List<Long> latenciesMs = new ArrayList<>(CONCURRENCY);
        for (Future<Long> future : futures) {
            Long latency = future.get(WAVE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (latency != null) {
                latenciesMs.add(latency);
            }
        }
        double wallMillis = (System.nanoTime() - wallStart) / 1_000_000.0;

        errors.stream().limit(3).forEach(error -> log.warn("[发压] 请求失败样例: {}", error));
        return new WaveResult(LatencyStats.of(toArray(latenciesMs), wallMillis), latenciesMs, errors.size());
    }

    /**
     * 计时口径：从发起请求到读完响应体，覆盖服务端处理 + 网络 + 反序列化；失败返回 null 不计入耗时样本
     */
    private Long timedRequest(ConcurrentLinkedQueue<String> errors) {
        long start = System.nanoTime();
        try {
            ResponseEntity<String> response = rest.exchange(apiBase + "/picture/list/page/vo", HttpMethod.POST,
                    new HttpEntity<>(QUERY_BODY, authHeaders), String.class);
            long elapsedMillis = (System.nanoTime() - start) / 1_000_000;
            String error = validate(response);
            if (error != null) {
                errors.add(error);
                return null;
            }
            return elapsedMillis;
        } catch (Exception e) {
            errors.add(e.getClass().getSimpleName() + ": " + e.getMessage());
            return null;
        }
    }

    /**
     * 只校验业务正确性；性能数值不参与断言，避免 GC 与调度抖动造成不稳定红灯
     */
    private String validate(ResponseEntity<String> response) {
        if (response.getStatusCode() != HttpStatus.OK) {
            return "HTTP 状态码非 200: " + response.getStatusCode();
        }
        try {
            JsonNode body = OBJECT_MAPPER.readTree(response.getBody());
            if (body.path("code").asInt(-1) != 0) {
                return "业务码非 0: code=" + body.path("code") + ", message=" + body.path("message");
            }
            JsonNode records = body.path("data").path("records");
            if (!records.isArray() || records.isEmpty()) {
                return "返回 records 为空，公共图库可能缺少过审测试数据";
            }
            return null;
        } catch (Exception e) {
            return "响应体解析失败: " + e.getMessage();
        }
    }

    private void warmUp() {
        ConcurrentLinkedQueue<String> errors = new ConcurrentLinkedQueue<>();
        if (timedRequest(errors) == null) {
            log.warn("[预热] 请求未成功: {}", errors.peek());
        }
    }

    private void clearAllCache() {
        assertTrue(requestData(HttpMethod.POST, "/picture/cache/clear-all").asBoolean(), "clear-all 应返回 true");
    }

    /**
     * 读取 L1/L2 缓存状态，用于证明每一波确实走在预期路径上
     */
    private JsonNode cacheStats() {
        return requestData(HttpMethod.GET, "/picture/cache/stats");
    }

    /**
     * 调用测试辅助接口并取出 data；这些调用位于计时区之外，失败即判定用例无效而非计入耗时
     */
    private JsonNode requestData(HttpMethod method, String path) {
        ResponseEntity<String> response = rest.exchange(apiBase + path, method, new HttpEntity<>(authHeaders), String.class);
        JsonNode body;
        try {
            body = OBJECT_MAPPER.readTree(response.getBody());
        } catch (Exception e) {
            throw new IllegalStateException(path + " 响应解析失败: " + e.getMessage(), e);
        }
        assertEquals(0, body.path("code").asInt(-1), path + " 调用失败: " + body.path("message"));
        return body.path("data");
    }

    /**
     * 登录取 Sa-Token；服务端 token-name 为 satoken，这里同时以 Cookie 与同名请求头回传，
     * 兼容 is-read-cookie / is-read-header 两种读取方式，不依赖具体下发的键名
     */
    private HttpHeaders loginAsAdmin() throws Exception {
        HttpHeaders loginHeaders = new HttpHeaders();
        loginHeaders.setContentType(MediaType.APPLICATION_JSON);
        String loginBody = String.format("{\"userAccount\":\"%s\",\"userPassword\":\"%s\"}", ADMIN_ACCOUNT, ADMIN_PASSWORD);
        ResponseEntity<String> response = rest.exchange(apiBase + "/user/login", HttpMethod.POST,
                new HttpEntity<>(loginBody, loginHeaders), String.class);

        JsonNode body = OBJECT_MAPPER.readTree(response.getBody());
        Assumptions.assumeTrue(body != null && body.path("code").asInt(-1) == 0,
                "管理员 " + ADMIN_ACCOUNT + " 登录失败，跳过性能测试: "
                        + (body == null ? "空响应" : body.path("message").asText()));

        String cookie = null;
        for (String setCookie : response.getHeaders().getOrDefault(HttpHeaders.SET_COOKIE, List.of())) {
            String nameValue = setCookie.split(";", 2)[0];
            if (cookie == null || nameValue.toLowerCase().contains("token")) {
                cookie = nameValue;
            }
        }
        Assumptions.assumeTrue(cookie != null, "登录响应未下发 Sa-Token，跳过性能测试");

        String tokenName = cookie.split("=", 2)[0];
        String tokenValue = cookie.split("=", 2)[1];
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.add(HttpHeaders.COOKIE, cookie);
        headers.add(tokenName, tokenValue);
        log.info("[缓存测试] 管理员登录成功, 令牌键={}", tokenName);
        return headers;
    }

    private void report(List<Long> missLatencies, List<Long> hitLatencies) {
        LatencyStats miss = LatencyStats.of(toArray(missLatencies), Double.NaN);
        LatencyStats hit = LatencyStats.of(toArray(hitLatencies), Double.NaN);

        log.info("==================== 两级缓存并发性能对比 ====================");
        log.info("接口: POST /api/picture/list/page/vo (公共图库主页, pageSize=20)");
        log.info("样本: {} 并发 x {} 波 = {} 请求/场景, 环境: 本机 MySQL + Redis"
                + "（测试上下文用 Lettuce 工厂替代 Redisson，见类内 LettuceOnlyConfiguration 说明）",
                CONCURRENCY, WAVES, missLatencies.size());
        log.info("不走缓存(并发击穿): avg={}ms, P50={}ms, P95={}ms, P99={}ms, max={}ms",
                fmt(miss.avgMs()), fmt(miss.p50Ms()), fmt(miss.p95Ms()), fmt(miss.p99Ms()), fmt(miss.maxMs()));
        log.info("走缓存(L1命中)     : avg={}ms, P50={}ms, P95={}ms, P99={}ms, max={}ms",
                fmt(hit.avgMs()), fmt(hit.p50Ms()), fmt(hit.p95Ms()), fmt(hit.p99Ms()), fmt(hit.maxMs()));
        log.info("平均延迟提升: {} 倍, P50 提升: {} 倍, P95 提升: {} 倍",
                ratio(miss.avgMs(), hit.avgMs()), ratio(miss.p50Ms(), hit.p50Ms()), ratio(miss.p95Ms(), hit.p95Ms()));
        log.info("说明: 未命中波的耗时主要包含 HikariCP(默认最大 10 连接) 的排队等待，"
                + "50 个并发同时穿透到 DB 时被放大，这正是并发下缓存收益高于串行基线的原因");
        log.info("说明: 缓存命中后 getPictureVoPage 仍会按 userId 批量查 user 表装配作者信息，"
                + "因此走缓存路径存在固定下限；缓存省掉的是 picture 分页查询，不是 Vo 装配开销");

        // 两组之间的相对关系比绝对值稳定，用宽松阈值兜住「缓存根本没生效」这类真问题
        assertTrue(hit.avgMs() < miss.avgMs(), "走缓存平均耗时未低于未命中，请检查缓存路径是否生效");
    }

    private static double ratio(double slow, double fast) {
        return fast <= 0 ? 0 : Math.round(slow / fast * 10) / 10.0;
    }

    private static String fmt(double value) {
        return String.format("%.1f", value);
    }

    private static long[] toArray(List<Long> values) {
        long[] array = new long[values.size()];
        for (int i = 0; i < array.length; i++) {
            array[i] = values.get(i);
        }
        return array;
    }

    /**
     * 一波的原始结果：统计值、逐请求耗时样本（毫秒）、失败数
     */
    private record WaveResult(LatencyStats stats, List<Long> latenciesMs, int failed) {

        int ok() {
            return latenciesMs.size();
        }
    }

    /**
     * 分位数统计，纯 JDK 实现，避免为一个测试引入新依赖
     */
    private record LatencyStats(long count, double avgMs, double minMs, double p50Ms, double p95Ms,
                                double p99Ms, double maxMs, double qps) {

        static LatencyStats of(long[] millisSamples, double wallMillis) {
            int total = millisSamples.length;
            if (total == 0) {
                return new LatencyStats(0, 0, 0, 0, 0, 0, 0, 0);
            }
            long[] sorted = Arrays.copyOf(millisSamples, total);
            Arrays.sort(sorted);
            double sum = 0;
            for (long value : sorted) {
                sum += value;
            }
            double qps = Double.isNaN(wallMillis) || wallMillis <= 0 ? 0 : total / (wallMillis / 1000.0);
            return new LatencyStats(total, sum / total, sorted[0], percentile(sorted, 50), percentile(sorted, 95),
                    percentile(sorted, 99), sorted[total - 1], qps);
        }

        private static double percentile(long[] sorted, int p) {
            int index = (int) Math.ceil(p * sorted.length / 100.0) - 1;
            return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
        }
    }

    /**
     * 临时绕过（等待根治方案确认）：当前依赖组合下 StringRedisTemplate 实际使用
     * Redisson 3.23.5 的 RedissonConnectionFactory，它与 spring-data-redis 3.5.4 新增的
     * {@code pExpire(byte[], long, Condition)} 默认方法互相自调用，形成无限递归，
     * 任何 {@code expire(Duration)} 都会抛 StackOverflowError —— Sa-Token 写会话即触发，登录必然 500，
     * 本测试因此拿不到管理员会话。这里仅在测试上下文把工厂换回 Lettuce，使性能链路可测；
     * 图片缓存自身的 {@code set(key,value,ttl,unit)} 在两种工厂下都正常，不影响被测路径的有效性。
     */
    @TestConfiguration
    static class LettuceOnlyConfiguration {

        @Bean
        @Primary
        LettuceConnectionFactory lettuceConnectionFactory(@Value("${spring.data.redis.host:localhost}") String host,
                                                          @Value("${spring.data.redis.port:6379}") int port) {
            RedisStandaloneConfiguration configuration = new RedisStandaloneConfiguration(host, port);
            configuration.setDatabase(0);
            return new LettuceConnectionFactory(configuration);
        }
    }
}
