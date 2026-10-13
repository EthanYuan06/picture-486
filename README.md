<div align="center">   <img src="./image/logo.ico" width="200"/>   <h1>昴云 · 智能 AI 云图库</h1> </div>



## 🎤 项目介绍
昴云 · 智能 AI 云图库，由 Java 21 + Spring Boot 3 开发的一款存放大量图片素材的智能云图片存储平台，支持用户将图片素材上传到公共图库，创建个人相册并管理，建立多人协作相册等功能，项目为对传统业务智能化升级，引入 AI 智能体模块，基于 LangGraph 编排开发，支持一句话上传图片、语义搜图、动漫图片与风景分析及 AI 审核功能。<font style="color:rgb(15, 17, 21);">

![](./image/login.png)

<font style="color:rgb(51, 51, 51);">核心能力：</font>

1. 【公共素材库】拥有海量图片的素材库，对所有用户公开，每个人都可以往公共图库上传自己的图片

![](./image/main.png)

2. 【个人相册】仅对当前用户开放的图库，普通用户最多可创建 5 个。相册中按时间对照片进行分类，方便用户查看

![](./image/album-page.png)

![](./image/my-album.png)

3. 【多人图库】对多个指定用户开放的图库，包含创建者、管理员、访客三个权限等级，除访客外可上传图片到图库中

![](./image/team-album.png)

![](./image/member-checking.png)

智能体能力：

<font style="color:rgb(15, 17, 21);">针对传统图库“搜图难、上传填写繁琐、人工审核效率低”的痛点，本项目引入了 AI 智能体能力，实现了从“纯手动管理”到“对话式交互”的智能化升级。在提供基础图片上传、展示与管理功能的同时，系统支持</font>**<font style="color:rgb(15, 17, 21);">对话式搜图</font>**<font style="color:rgb(15, 17, 21);">（基于内容理解，支持动漫识图、风景辨认与通用分析）、</font>**<font style="color:rgb(15, 17, 21);">一句话上传</font>**<font style="color:rgb(15, 17, 21);">（AI 自动生成图片信息，用户确认后上传）以及 </font>**<font style="color:rgb(15, 17, 21);">AI 智能审核</font>**<font style="color:rgb(15, 17, 21);">，大幅降低了用户的操作成本并提升了管理效率。</font>

<font style="color:rgb(15, 17, 21);">以下是 AI 智能模块的项目展示：</font>

![](./image/agent.png)

4. 【语义搜索】：用户能直接与 AI 图库助手对话，用自然语言或上传一张图片进行搜图，AI 会给出贴合描述的多张图片

![](./image/search-by-word.png)

![](./image/picture.png)

5. 【一句话上传】：为了解决手动填图片信息上传的麻烦，用户可选择直接将一张图发给 AI ，并表明上传行为，AI 会自动分析图片并填充信息，经用户确认或修改后，一键上传

![](./image/auto-filling.png)

![](./image/detail-generated-by-ai.png)

6. 【图片分析】：体验增强功能，已包含动漫角色识图、风景分析两类。用户给一个动漫人物图片，AI 能基于搜索结果回答用户；用户问图中景点在哪，AI 会准确回答地点与简略的旅游攻略

![](./image/anime-search.png)

![](./image/landscape-search.png)

7. 【AI 审核】：上传的图片会经过 AI 审核，以管理员手动审核兜底，实现大量图片上传后的审核自动化，大幅解放管理员的双手

![](./image/review-by-ai.png)

<font style="color:rgb(51, 51, 51);">其他功能：</font>

+ <font style="color:rgb(51, 51, 51);">个人中心：支持用户修改个人信息</font>

![](./image/information.png)

+ <font style="color:rgb(51, 51, 51);">图片下载：点击按钮立即下载图片到本地</font>

![](./image/details.png)

+ <font style="color:rgb(51, 51, 51);">管理员专用：包含后台审核、系统分析、相册管理、用户管理、公共图库管理等功能</font>

![](./image/system-analysis.png)

+ <font style="color:rgb(51, 51, 51);">⏰</font><font style="color:rgb(51, 51, 51);">喜欢 / 收藏：待开发</font>
+ <font style="color:rgb(51, 51, 51);">⏰</font><font style="color:rgb(51, 51, 51);">智能体图文搜索：</font><font style="color:rgb(51, 51, 51);"></font><font style="color:rgb(51, 51, 51);">检索精度有缺陷，待优化</font>

## 🔧 技术选型
![](./image/infrastructure.jpeg)

## ✨ 核心亮点
+ 【项目架构】
    - 采用 Java + Python 双后端异构微服务，Python 智能体模块对传统业务智能升级
    - 基于 DDD 架构设计 Spring Boot 后端，将业务细节下沉到领域层，适合跨部门多方协作
+ 【性能优化】
    - 通过 Redis + Caffeine 多级缓存架构，将首页图片展示接口响应从 55ms 优化至 29ms
    - 批量查用户 id + Map 存用户及其上传的图片，防止查图片时重复查用户信息这类 N+1 查询
    - 图片经压缩为 webp 后展示，清晰度影响小同时大量减少带宽，提高响应速度
+ 【编码设计】
    - AOP 权限校验：通过自定义注解 + 校验拦截器实现切面校验，无需在接口中重复写校验逻辑
    - 模板方法设计上传模式，将上传流程抽象为模板，子类实现文件/URL两类上传方式
+ 【智能体模块】
    - Supervisor 多智能体架构实现图片分析功能，新增分析类型只需要注册专家 Agent 并实现基类方法
    - 多模态 RAG：让 AI 理解图片内容，再结合元信息匹配提高检索精确度
    - AI 审核：Java 端将审核任务送入 RabbitMQ 消息队列，Python 智能体端进行消费，AI 审核完毕后回调 Java 端将结果写入数据库

## 📂 项目结构
```plain
486-picture-backend/                          
│
├── src/                                      ── Java 后端
│   ├── main/java/com/yuluo/
│   │   ├── Picture486BackendApplication.java     启动类
│   │   └── picture486ddd/
│   │       ├── interfaces/                       接口层
│   │       │   ├── controller/                   REST 控制器
│   │       │   ├── dto/  vo/                     入参 / 出参模型
│   │       │   └── assembler/                    DTO-领域对象转换
│   │       ├── application/service/              应用层（编排用例）
│   │       ├── domain/                           领域层
│   │       │   ├── picture/  space/              图片、空间域
│   │       │   ├── user/  message/               用户、消息域
│   │       │   └── constant/                     领域常量
│   │       ├── infrastructure/                   基础设施层
│   │       │   ├── mapper/  repository/          MyBatis-Plus 持久化
│   │       │   ├── mq/                           RabbitMQ 生产/消费
│   │       │   ├── websocket/                    WebSocket 推送
│   │       │   ├── api/                          AI 微服务客户端
│   │       │   ├── aop/  annotation/             切面（权限/日志）
│   │       │   ├── config/  exception/           配置、全局异常
│   │       │   └── common/  utils/               通用组件（Redis/COS/缓存）
│   │       └── shared/manager/                   共享管理器
│   ├── main/resources/
│   │   ├── application.yml + -dev/-prod/-docker  多环境配置
│   │   ├── mapper/*.xml                          5 个 SQL 映射
│   │   ├── biz/spaceUserAuthConfig.json          空间权限矩阵
│   │   └── static/tech-stack.html                技术栈架构图
│   └── test/java/                                单元测试
│
├── agent/                                    ── Python AI 微服务（FastAPI + LangGraph）
│   ├── app/
│   │   ├── main.py                               FastAPI 入口
│   │   ├── api/                                  chat.py / chat_sse.py / cos.py
│   │   ├── agent/                                LangGraph 多子图
│   │   │   ├── workflow.py  state.py  tool.py    主图编排 / 状态 / Tavily 工具
│   │   │   ├── all_agent.py                      Supervisor 汇总
│   │   │   ├── chat/                             对话子图（nodes/prompts）
│   │   │   ├── rag/                              以图/文字检索子图
│   │   │   ├── image_analysis/                   图片分析子图
│   │   │   ├── image_upload/                     AI 上传子图（tool）
│   │   │   ├── ai_review/                        内容安全审核子图
│   │   │   ├── public_nodes/  prompts/           公共节点、提示词
│   │   │   ├── model/model.py                    DeepSeek/Qwen/Embedding/Rerank
│   │   │   └── config/                           LLM 参数
│   │   ├── mcp/                                  MCP 客户端与 server 配置
│   │   ├── config/redis_config.py                Redis Checkpointer
│   │   ├── utils/  common/  entity/              向量化工具/通用/实体
│   │   └── chroma_data/                          Chroma 本地持久化
│   ├── pyproject.toml + uv.lock                  uv 依赖（Python 3.14）
│   ├── langgraph.json                            LangGraph 图注册
│   ├── Dockerfile  docker-compose.yml  init.sql  Agents.md
│
├── 486-picture-frontend/                     ── React 前端
│   ├── src/
│   │   ├── components/                           Assistant/Albums/PictureManage/
│   │   │                                         HitlUpload/SpaceAnalyze 等 11 个模块
│   │   ├── services/  stores/                    API 封装 / Zustand 状态
│   │   ├── utils/  types/  static/               工具 / 类型 / 资源
│   ├── vite.config.ts  tailwind.config.cjs       构建与样式
│   ├── nginx/  Dockerfile  dist/                 反代与镜像
│
├── sql/                                        init.sql、测试数据
├── jmeter/                                     性能测试（.jmx + 缓存/锁/RAG 评测脚本）
├── image/                                      产品截图与架构图素材
├── Dockerfile  deploy.sh  init.sql             Java 镜像与一键部署
└── pom.xml                                     Maven 构建
```

## 🚀 快速开始
```bash
## 环境要求

| 环境    | 版本                                 |
| ------- | ------------------------------------ |
| JDK     | 21+                                  |
| Maven   | 3.8+                                 |
| Python  | 3.14+（uv）                          |
| Node.js | 18+                                  |
| Docker  | 24+（用于 MySQL / Redis / RabbitMQ） |

## 克隆项目
git clone https://github.com/EthanYuan06/picture-486.git 
D:/Code/486-picture/486-picture-backend

cd D:/Code/486-picture/486-picture-backend

## Docker 一键启动
cd agent
docker compose up -d --build
访问：http://localhost:5173
```



