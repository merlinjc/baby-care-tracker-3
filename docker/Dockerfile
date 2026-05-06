# ==============================================================================
#  Baby Care Tracker Web - 多阶段构建
#  目标产物：单容器同时承载已构建的 React 静态文件 + Node.js 后端
#  Nginx 作为同伴容器统一对外（见 docker-compose.yml）
# ==============================================================================

# ---------- Stage 1: 共享依赖安装 ----------
FROM node:20-alpine AS deps
WORKDIR /workspace

# 启用 pnpm（Node 20 内置 corepack）
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 复制依赖清单
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json* ./shared/

# 安装全部 workspace 依赖（构建期需要 devDeps）
RUN pnpm install --frozen-lockfile=false


# ---------- Stage 2: 构建前端 ----------
FROM deps AS client-builder
WORKDIR /workspace
COPY shared ./shared
COPY client ./client
RUN pnpm --filter client build
# 产物在 /workspace/client/dist


# ---------- Stage 3: 构建后端 + 生成 Prisma Client ----------
FROM deps AS server-builder
WORKDIR /workspace
COPY shared ./shared
COPY server ./server
# 生成 Prisma Client（prisma 已声明在 server 依赖里）
RUN cd server && npx prisma generate
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
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY server/package.json ./server/
COPY shared/package.json* ./shared/
RUN pnpm install --prod --frozen-lockfile=false --filter server...

# 拷贝构建产物
COPY --from=server-builder /workspace/server/dist ./server/dist
COPY server/prisma ./server/prisma
COPY shared ./shared

# 在 runtime 层重新生成 Prisma Client（避免跨阶段拷贝依赖 pnpm hoisting 路径）
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
# 启动前自动应用 Prisma migrations，再起 Node
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server/src/app.js"]


# ---------- Stage 5: 仅前端静态产物（一次性容器，启动时把 dist 拷入共享 volume） ----------
FROM alpine:3.19 AS client-dist
RUN apk add --no-cache coreutils
WORKDIR /dist
COPY --from=client-builder /workspace/client/dist /dist/
# docker-compose 中 command 会覆盖此处，但保留默认行为方便单独运行
CMD ["sh", "-c", "cp -r /dist/. /shared/ && echo 'client dist published' && sleep 1"]
