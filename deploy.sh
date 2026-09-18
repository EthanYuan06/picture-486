#!/bin/bash
#
# 宝塔 Linux 命令行一键部署脚本 (本地构建版)
# 流程: 校验 .env -> 校验构建上下文 -> 构建镜像 -> 启动全栈
#
# 用法: 在仓库根目录执行  bash deploy.sh
#
set -e

# ==================== 路径 ====================
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="$ROOT_DIR/agent"
COMPOSE_FILE="$AGENT_DIR/docker-compose.yml"

# ==================== compose 命令兼容 ====================
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

echo "=========================================="
echo "  部署目录 : $ROOT_DIR"
echo "  Compose  : $COMPOSE"
echo "=========================================="

# ==================== 1. 校验 agent/.env ====================
echo "[1/5] 校验 agent/.env ..."
if [ ! -f "$AGENT_DIR/.env" ]; then
  echo "  ✗ 错误: 未找到 $AGENT_DIR/.env" >&2
  echo "    .env 已被 .gitignore/.dockerignore 排除, 请先手动上传到 agent 目录" >&2
  exit 1
fi
echo "  ✓ .env 存在"

# ==================== 2. 校验构建上下文目录 ====================
echo "[2/5] 校验前端/后端构建上下文 ..."
# 从 .env 读取 FRONTEND_DIR (相对 agent 目录), 默认 ../../486-picture-frontend/subarupic
FRONTEND_DIR="$(grep '^FRONTEND_DIR=' "$AGENT_DIR/.env" | head -n1 | cut -d= -f2-)"
FRONTEND_DIR="${FRONTEND_DIR:-../../486-picture-frontend/subarupic}"
FRONTEND_ABS="$(cd "$AGENT_DIR" && cd "$FRONTEND_DIR" 2>/dev/null && pwd || echo "")"
if [ -z "$FRONTEND_ABS" ] || [ ! -f "$FRONTEND_ABS/Dockerfile" ]; then
  echo "  ✗ 错误: 未找到前端工程 Dockerfile" >&2
  echo "    期望路径: $AGENT_DIR/$FRONTEND_DIR" >&2
  echo "    请确认前端工程与后端为同级目录, 或修改 agent/.env 里的 FRONTEND_DIR" >&2
  exit 1
fi
echo "  ✓ 前端工程: $FRONTEND_ABS"
if [ ! -f "$ROOT_DIR/Dockerfile" ]; then
  echo "  ✗ 错误: 未找到后端 Dockerfile ($ROOT_DIR/Dockerfile)" >&2
  exit 1
fi
echo "  ✓ 后端工程: $ROOT_DIR"

# ==================== 3. 构建全部镜像 ====================
echo "[3/5] 构建镜像 (docker compose build) ..."
cd "$AGENT_DIR"
$COMPOSE -f "$COMPOSE_FILE" build

# ==================== 4. 启动全栈 ====================
echo "[4/5] 启动服务 (docker compose up -d) ..."
$COMPOSE -f "$COMPOSE_FILE" up -d --remove-orphans

# ==================== 5. 查看状态 ====================
echo "[5/5] 当前服务状态:"
$COMPOSE -f "$COMPOSE_FILE" ps

echo "=========================================="
echo "  部署完成"
echo "  查看日志: cd $AGENT_DIR && $COMPOSE logs -f ai-backend"
echo "=========================================="
