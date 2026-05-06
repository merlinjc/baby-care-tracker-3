# ==============================================================================
#  Baby Care Tracker Web - 多阶段构建（v2，仅做安全的层顺序优化）
#  目标产物：runtime（Node 后端） + client-dist（静态资源 sidecar）
#  Nginx 作为同伴容器统一对外（见 docker-compose.yml）
#
#  v2 vs v1（保守版）：
#   ✅ COPY 粒度从"整目录"拆为"先 config 后 src"，业务代码改动不再吹掉所有层
#   ✅ pnpm store 用 BuildKit cache mount（本地 build 受益；GHA 上不影响）
#   ❌ 暂不引入"独立 prisma-generator 阶段"——pnpm hoisting 路径在 alpine 下不稳
#       仍沿用"runtime 阶段重新跑 prisma generate"的已知可用方案
# ==============================================================================

# ---------- Stage 1: 共享依赖安装 ----------
FROM node:20-alpine AS deps
WORKDIR /workspace

# 启用 pnpm（Node 20 内置 corepack）
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 仅复制依赖清单（lock + 各 workspace package.json）
# ⭐ lock 与 package.json 改动才会失效本层
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# 安装全部 workspace 依赖（构建期需要 devDeps）
# ⭐ BuildKit cache mount 让 pnpm store 跨构建持久复用（本地受益；GHA runner 一次性无影响）
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile=false


# ---------- Stage 2: 构建前端 ----------
FROM deps AS client-builder
WORKDIR /workspace
# ⭐ 先拷不变的配置文件（变动频率低）
COPY client/tsconfig.json client/tsconfig.app.json client/tsconfig.node.json \
     client/vite.config.ts client/index.html client/components.json \
     client/eslint.config.js \
     ./client/
COPY client/public ./client/public
COPY shared ./shared
# ⭐ 业务源码放最后（变动频率最高）
COPY client/src ./client/src
RUN pnpm --filter client build
# 产物在 /workspace/client/dist


# ---------- Stage 3: 构建后端 + 生成 Prisma Client ----------
FROM deps AS server-builder
WORKDIR /workspace
# ⭐ 先 prisma schema（变动频率约月级）
COPY server/prisma ./server/prisma
RUN cd server && npx prisma generate
# ⭐ 再 tsconfig 和源码
COPY shared ./shared
COPY server/tsconfig.json ./server/
COPY server/src ./server/src
# 编译 TS -> JS
RUN pnpm --filter server build
# 产物在 /workspace/server/dist


# ---------- Stage 4: 运行时镜像（仅 server，client 由 nginx 容器挂载） ----------
FROM node:20-alpine AS runtime
WORKDIR /app

# 时区 + 健康检查工具
RUN apk add --no-cache tzdata curl && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 启用 pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 仅安装 server 的 production 依赖
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile=false --filter server...

# 拷贝构建产物
# ⭐ prisma 相关放前面（schema 变动频率低于业务代码）
COPY server/prisma ./server/prisma
COPY shared ./shared
COPY --from=server-builder /workspace/server/dist ./server/dist

# 在 runtime 层重新生成 Prisma Client（避免跨阶段拷贝依赖 pnpm hoisting 路径）
# 注：未来若验证通过 hoisting 路径稳定，可改为 COPY --from=server-builder 直接复用
WORKDIR /app/server
RUN npx prisma generate
WORKDIR /app

# 持久化目录（运行时挂载，存放 SQLite/上传文件等）
RUN mkdir -p /app/data /app/uploads

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL="file:/app/data/prod.db"

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

WORKDIR /app/server
# 启动前同步 Prisma schema 到数据库，再起 Node
# 说明：本项目当前未使用 migrations（与 docs/devops-workflow.md §6.2 约定一致：pnpm db:push）
#   - 若 prisma/migrations 目录存在 → 优先 migrate deploy（向 MySQL 切换后启用）
#   - 否则 fallback 到 db push（SQLite 阶段使用，幂等：表已存在不会丢数据）
CMD ["sh", "-c", "if [ -d prisma/migrations ]; then npx prisma migrate deploy; else npx prisma db push --skip-generate --accept-data-loss; fi && node dist/server/src/app.js"]


# ---------- Stage 5: 仅前端静态产物（一次性容器，启动时把 dist 拷入共享 volume） ----------
FROM alpine:3.19 AS client-dist
RUN apk add --no-cache coreutils
WORKDIR /dist
COPY --from=client-builder /workspace/client/dist /dist/
# docker-compose 中 command 会覆盖此处，但保留默认行为方便单独运行
CMD ["sh", "-c", "cp -r /dist/. /shared/ && echo 'client dist published' && sleep 1"]
