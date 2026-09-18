# 昴云 - AI智能图库助手

## 项目简介

本项目是 Spring 后端项目《昴云相册》的 Python AI 微服务模块，替代原有 SQL 模糊检索、人工审核的传统方案，提供**多模态图片检索、智能图片分析、AI 内容审核**及闲聊对话能力，为相册产品赋予智能化体验。

该微服务全部由个人独立开发完成，属于结合 AI 编程工具落地的实践项目，已正式上线并在小范围投入真实使用。

在线访问：subarupic.art

## 技术栈

- Web框架：FastAPI   
  - 与前端和后端回调接口对接，提供异步HTTP与SSE流式输出能力
- AI开发框架：LangGraph + LangChain   &#x20;
  - LangGraph 负责 Agent 工作流编排，LangChain 负责提供组件化能力
- 大模型：
  - deepseek-v4-flash：文本模型，承担Token消耗量大的任务，用于闲聊、工具调用、总结输出
  - qwen3.7-plus：多模态模型，用于接收image\_url与视觉分析，例如审核、意图识别、风景分析，主要提供多模态能力
  - qwen3-vl-embedding：多模态嵌入模型，用于离线图片向量化存储、用户消息多模态向量化，保证消息与向量库向量处于同一向量空间
  - qwen3-vl-rerank：多模态重排序模型，结合用户图文消息，再对候选图片进一步视觉分析，实现精细排序
- 向量数据库：Chroma
  - 存储图片名称、简介、内容融合的多模态向量 + 结构化元信息（id、标签、分类等）
- 状态与会话持久化：Redis Checkpoint
  - 支持分布式项目、自动TTL、内存级读取速度
- 消息队列：RabbitMQ
  - 异步解耦“AI审核”这类延时任务
- 对象存储：腾讯云 COS
  - 存储图片并提供压缩处理、在线URL提供
- 部署：Docker Compose  + 腾讯云轻量云服务器（宝塔Linux）
  - 通过 Shell 脚本实现 Git 拉取 + 容器编排自动化部署

## 项目目录

```text
subarupic-ai/
├─ app/
│  ├─ api/       # FastAPI 接口层：对话、SSE、COS 上传
│  ├─ agent/     # 核心能力层：工作流编排、RAG、图片分析、图片上传、审核
│  ├─ config/    # 基础设施配置：如 Redis Checkpoint
│  ├─ entity/    # 请求/响应等数据结构定义
│  ├─ mcp/       # MCP 客户端与服务配置
│  ├─ utils/     # 通用工具函数
│  ├─ test/      # 核心链路测试与验证脚本
│  └─ main.py    # 服务启动入口
├─ chroma_data/  # Chroma 向量库持久化数据
├─ docker-compose.yml # 容器编排配置
├─ pyproject.toml # 依赖管理
└─ langgraph.json # LangSmith调试配置
```

## 核心功能

### 1. 智能对话与流式返回

- 提供会话创建、会话校验、普通对话和 SSE 流式对话接口。
- 基于 `thread_id` 区分不同会话上下文，会话状态通过 Redis Checkpoint 持久化，支持多轮连续对话。

技术实现方案：

- `app/api/chat.py` 和 `app/api/chat_sse.py` 负责暴露 HTTP / SSE 接口。
- `app/config/redis_config.py` 使用 `AsyncRedisSaver` 保存 LangGraph 运行状态，默认保留 7 天。

### 2. 基于 LangGraph 的智能体编排

- 将用户请求按意图路由到闲聊、检索问答、图片分析、图片上传等不同链路。
- 支持图文混合输入，统一由单张主工作流完成调度与输出格式化。

技术实现方案：

- `app/agent/workflow.py` 作为主图入口，注册意图识别、RAG 检索、图片分析、图片上传、错误处理等节点。
- 主图通过条件边完成路由，子能力以独立业务模块形式拆分，便于后续扩展。

### 3. 图片分析与上传辅助

- 支持图片内容分析，并在上传场景中引入 HITL （人机回环）确认机制，允许用户确认后继续执行。
- HITL基于LangGraph的`interrupt_before`
- 提供 COS 预签名上传地址，便于前端直传图片并回传公网访问链接。

技术实现方案：

- `app/agent/image_analysis` 采用子图方式组织分析流程，由不同节点协作完成结果生成。
- `app/agent/image_upload` 在回调前支持中断恢复，结合用户确认信息继续执行。
- `app/api/cos.py` 基于腾讯云 COS 生成预签名上传 URL。

### 4. AI 审核异步消费与回调

- 服务启动后自动拉起 RabbitMQ 消费者，异步处理图片审核任务，并将结果回调给后端系统。
- 审核链路支持手动 ACK、失败重入队和死信队列保证异常消息零丢失，保证消息处理可靠性。

技术实现方案：

- `app/agent/ai_review/consumer.py` 在线程中启动 MQ 消费逻辑，避免阻塞 FastAPI 主进程。
- 审核工作流完成后调用后端回调接口，实现 AI 服务与业务后端解耦。

## 快速开始

### 1. 安装 Docker 服务

前往官网在电脑上安装 Docker Desktop

<https://www.docker.com/products/docker-desktop/>

> 如果已安装请忽略，直接使用命令启动😊

### 2. 启动项目

Docker 一键启动：

```bash
docker compose up -d
```

启动后默认可通过 `http://127.0.0.1:8024` 访问 AI 服务。

> 💡每次执行时需要构建AI项目镜像，时长大约1分钟

