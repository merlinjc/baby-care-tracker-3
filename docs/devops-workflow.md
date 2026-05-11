# Baby Care Tracker Web · 开发与发布工作流

> **版本**：v1.2  ·  **最后更新**：2026-05-06
> **适用范围**：`baby-care-tracker-web` 全栈（client + server）
> **目标读者**：负责本仓库开发、Code Review、发布的工程师

---

## 1. 整体架构与流转

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          本地开发环境（macOS / Linux）                        │
│                                                                            │
│   pnpm dev:client (5173)  ─┐                                              │
│                            ├──► Vite proxy ──► localhost:3000              │
│   pnpm dev:server (3000)  ─┘                                              │
│                                                                            │
│   git commit & push                                                        │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         GitHub（或工蜂）远端仓库                              │
│                                                                            │
│   PR ──► CI workflow                                                       │
│            ├─ pnpm install                                                 │
│            ├─ prisma generate                                              │
│            ├─ tsc -b                                                       │
│            ├─ build:client / build:server                                  │
│            └─ docker build (smoke)                                         │
│                                                                            │
│   merge to main ──► Deploy workflow                                        │
│            ├─ docker build (runtime + client-dist)                         │
│            ├─ push to TCR (ccr.ccs.tencentyun.com/merlinjc/...)            │
│            └─ ssh server: docker compose pull + up -d                      │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────────┐
│              Lighthouse 服务器  152.136.125.185  (OpenCloudOS 9.4)          │
│                                                                            │
│   :80  ──► 301 ──► https://www.neo3.cn （default_server / 全量跳转）      │
│   :443 ──► nginx (容器, TLS)  ──► /api/* ──► server (容器, :3000)          │
│                                └─► /* ─────► client_dist (volume, 静态)   │
│                                                                            │
│   持久化卷：server_data (SQLite) · server_uploads · client_dist            │
│   Cron 02:00：每日打包 SQLite → /opt/baby-care/backups/  (保留 14 天)      │
└────────────────────────────────────────────────────────────────────────────┘
```

| 角色 | 触发条件 | 谁执行 | 产出 |
|---|---|---|---|
| **本地开发** | `pnpm dev` | 开发者 | 本地热更新 |
| **CI** | PR / push 任意分支 | GitHub Actions | 编译产物 + Docker smoke |
| **CD** | `main` 推送 / 手动触发 | GitHub Actions | 生产环境更新 |
| **手动部署** | `pnpm deploy` | 开发者本机 | 同 CD（应急通道） |
| **运维** | `pnpm remote logs/ps/...` | 开发者本机 | 远程诊断 |

---

## 2. 仓库结构（DevOps 相关）

```
baby-care-tracker-web/
├── .github/workflows/
│   ├── ci.yml                  # PR 持续集成
│   └── deploy.yml              # main 持续部署
│
├── docker/
│   ├── Dockerfile              # 多阶段构建（runtime + client-dist）
│   ├── docker-compose.yml      # 生产编排（server + nginx + client-dist）
│   ├── nginx.conf              # 反向代理 + SPA fallback + 安全头
│   ├── .env.example            # 环境变量模板
│   └── .env                    # 实际密钥（gitignore，本机持有）
│
├── scripts/
│   ├── deploy.sh               # 本机一键部署
│   ├── server-bootstrap.sh     # 服务器首次初始化
│   └── remote.sh               # 远程运维快捷命令
│
├── BJ_Baby_Care_Tracker.pem    # SSH 密钥（gitignore）
└── package.json                # pnpm scripts: dev / build / docker / deploy
```

---

## 3. 分支模型

采用简化版 GitHub Flow（与小程序版的 v3.2 Git Flow 兼容）：

| 分支 | 用途 | 部署策略 |
|---|---|---|
| `master`（本仓库主分支）/ `main` | 生产分支，永远可发布 | **推送即自动部署到生产** |
| `develop` | 集成分支（可选） | 仅 CI，不部署 |
| `feature/*` | 功能开发 | 仅 CI |
| `fix/*` | 修复 | 仅 CI |
| `release/*` | 发布准备（如有） | 手动触发部署 |

**约定**：
- 任何分支提 PR 时触发 CI；
- 只有主分支（`master` / `main`）推送会触发 CD；
- 通过 `Actions → Deploy → Run workflow` 可手动指定 tag 部署（应急、回滚）。

---

## 4. 环境清单

### 4.1 本地开发

| 组件 | 版本要求 | 说明 |
|---|---|---|
| Node.js | ≥ 20.x | 后端运行时 |
| pnpm | ≥ 9.x | Monorepo 包管理 |
| Docker Desktop | ≥ 24.x | 用于构建生产镜像 |
| 微信开发者工具 | 任意 | 仅小程序版调试 |

### 4.2 服务器

| 项 | 实际值 |
|---|---|
| 主机 | `152.136.125.185` |
| 系统 | OpenCloudOS 9.4 (kernel 6.6.117) |
| 规格 | 2C / 2G / 40GB |
| 用户 | `root`（部署用），`lighthouse` / `www`（其他） |
| Docker | 28.0.1 |
| Docker Compose | 2.32.1 |
| 默认监听 | 22 (SSH), 8888 (宝塔), 80/443 (Nginx 容器) |
| 部署目录 | `/opt/baby-care` |

### 4.3 必需的环境变量（`docker/.env`）

| 变量 | 是否必填 | 示例 |
|---|---|---|
| `IMAGE_REGISTRY` | 自动 | `ccr.ccs.tencentyun.com/merlinjc/baby-care-tracker-3`（CD 自动渲染；本机 `deploy.sh` 用 `baby-care-tracker-web`） |
| `IMAGE_TAG` | 自动 | `c0a1b2c`（commit short sha） |
| `DATABASE_URL` | 是 | `file:/app/data/prod.db`（SQLite）|
| `JWT_SECRET` | 是 | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | 是 | 同上 |
| `CORS_ORIGIN` | 是 | 生产指定域名，过渡期 `*` |
| `OPENAI_API_KEY` | 否 | 启用 AI 时必填（TokenHub key，形如 `sk-...`） |
| `OPENAI_BASE_URL` | 否 | 默认 `https://tokenhub.tencentmaas.com/v1`，切私有网关时覆盖 |
| `OPENAI_MODEL` | 否 | 默认 `hy3-preview` |
| `AI_DAILY_QUOTA` | 否 | 默认 `100` |
| `AI_FETCH_TIMEOUT_MS` | 否 | 默认 `30000`（ms） |
| `PATROL_ENABLED` | 否 | 默认 `false` |
| `COS_SECRET_ID` | 否 | 启用图片上传必填；缺失时 `/api/uploads` 返回 503，前端优雅降级 |
| `COS_SECRET_KEY` | 否 | 同上 |
| `COS_BUCKET` | 否 | 桶名，形如 `babycare-1300015547`（含 APPID 后缀） |
| `COS_REGION` | 否 | 形如 `ap-beijing` |
| `COS_MAX_UPLOAD_BYTES` | 否 | 服务端单文件最大字节数（multer + service 双层校验），默认 `2097152`（2MB） |
| `COS_DOWNLOAD_CACHE_MAX_AGE` | 否 | 下载代理 Cache-Control max-age（秒），默认 `86400`（1 天）；设 0 禁用缓存 |

---

### 4.4 腾讯云 COS 配置流程（v7.2+ 服务端代理模式）

**架构提醒**：v7.2 起 COS 走 **服务端代理模式**——所有上传 / 下载经 Express，密钥永远不暴露给客户端。这与第三方"客户端直传"的常见做法**显式不同**，请勿配置桶为公有读或开 CORS（不必要）。

**何时需要**：启用 F12 用户头像、Sprint 2 F11 每日打卡照片等图片上传功能。
**何时跳过**：仅做核心记录功能、不需要图片上传时，可暂不配置；缺配置时 `/api/uploads` 返回 503，前端会优雅降级为默认头像。

**步骤**：

1. **建桶**：[腾讯云 COS 控制台](https://console.cloud.tencent.com/cos/bucket) → 创建存储桶
   - 区域：与服务器同区（生产 `ap-beijing`，与 Lighthouse 一致）
   - 访问权限：**私有读私有写**（所有访问经我方服务端代理，密钥不暴露）
   - 命名：形如 `babycare-{appid}`，APPID 后缀由腾讯云自动追加

2. **CORS 设置**：**不需要配置**。
   - 服务端代理模式下，浏览器只与我方域名通信，不会跨域请求 COS
   - 如果你之前配过 CORS，可以保留也可以移除，对功能无影响

3. **创建 API 密钥**：[访问管理控制台](https://console.cloud.tencent.com/cam/capi)
   - 推荐做法：**新建子账号** + 生成 AccessKey，**不要用主账号密钥**
   - 权限策略：自定义策略，仅授予对该桶的 `cos:PutObject` / `cos:GetObject` / `cos:HeadObject` / `cos:DeleteObject` 权限（最小权限原则）
   - 桶资源：`qcs::cos:ap-beijing:uid/xxx:babycare-1300015547/*`

4. **写入服务器 `docker/.env`**：
   ```bash
   COS_SECRET_ID=YOUR_TENCENT_CLOUD_SECRET_ID_HERE
   COS_SECRET_KEY=YOUR_TENCENT_CLOUD_SECRET_KEY_HERE
   COS_BUCKET=babycare-1300015547
   COS_REGION=ap-beijing
   COS_MAX_UPLOAD_BYTES=2097152      # 服务端兜底 2MB（客户端会先压到 ~1MB）
   COS_DOWNLOAD_CACHE_MAX_AGE=86400  # 浏览器缓存 1 天
   ```

5. **重启服务**：`pnpm remote restart` 或 deploy.sh 触发的 docker compose up

6. **验证**：
   ```bash
   # 路由通了应得 401（缺 token）
   curl -i -X POST https://www.neo3.cn/api/uploads
   # → 401 UNAUTHORIZED

   # 缺凭证（在 .env 故意置空）应得 503
   curl -i -X POST https://www.neo3.cn/api/uploads \
     -H 'Authorization: Bearer <test-jwt>' \
     -F 'file=@./test.jpg' -F 'kind=avatar' -F 'ext=jpg'
   # → 503 UPLOAD_NOT_CONFIGURED

   # 配完凭证 + 带 token 应得 201 + { key, size, contentType }
   ```

7. **下载验证**：用上一步返回的 key 直接 GET：
   ```bash
   curl -i https://www.neo3.cn/api/uploads/avatars/u1/abc.jpg \
     -H 'Authorization: Bearer <test-jwt>'
   # → 200 + Content-Type: image/jpeg + 流式 body
   ```

**Nginx 提示**：
- 上传：`client_max_body_size 4m;`（COS_MAX_UPLOAD_BYTES 的 2x，给 multipart boundary 留余量）
- 下载：`proxy_buffering on;`（让 nginx 帮忙缓冲流式响应）；`proxy_cache` 可选（key 是 immutable，加 nginx cache 能挡住重复回源 COS 的流量）

**降级行为**：缺任一 `COS_*` 字段 → `/api/uploads` 返回 503 `UPLOAD_NOT_CONFIGURED` → 前端 ImageUploader toast 提示「图片上传服务未配置，请联系管理员」，主流程不阻塞，默认头像仍可显示。

### 4.5 Patrol 巡检任务（v7.2+）

后端启动时自动注册 patrol 任务（除非 `PATROL_ENABLED=false` 或 `NODE_ENV=test`）。当前任务清单：

| 任务 | 周期 | 默认 dryRun | 作用 |
|---|---|---|---|
| `familyConsistency` | 每日 | true | 校验 `users.familyId` 与 `family_members` 一致性；规则 B 在 `PATROL_DRY_RUN=false` 时自动修复 |
| `aiQuotaCleanup` | 每周 | true | 删除 60 天前的 `AIQuota` 记录（FR-E4） |
| `dailyCheckinOrphanCleanup`（v7.2 T-S2-F11） | 每周（周日 04:00） | true | 列 COS `checkins/` 前缀对象 → DB `DailyCheckin.photoKey` 反查 → ≥ 30 天未引用的对象批量删除 |

**调度实现**：原生 `setInterval` + 启动时校时，不引入 node-cron。
**互斥锁**：通过 `RateLimit` 表实现"乐观锁式领导选举"，多实例部署只有一个实例真正执行（其余跳过）。

**dailyCheckinOrphanCleanup 的 30 天阈值**：
- 给手动恢复留窗口（防止"DB 已删但 1 周内发现是误删，回滚 DB 后对象还在"）
- 也覆盖"上传成功但 create 落 DB 失败"的极端场景（最长延迟 30 天才会被清）

**生产开启自动修复**：在 `docker/.env` 设：

```
PATROL_DRY_RUN=false
```

不设置时全部 patrol 仅统计 + 写 OperationLog，不做实际写入 / 删除。

---

## 5. 首次配置（一次性）

```bash
# 1. 拉取代码
git clone <repo-url> baby-care-tracker-web
cd baby-care-tracker-web

# 2. 安装依赖
pnpm install

# 3. 配置后端 .env（本地开发用）
cp server/.env.example server/.env
vi server/.env   # 至少填 DATABASE_URL / JWT_SECRET

# 4. 初始化数据库
pnpm db:push     # SQLite 直接同步 schema
pnpm --filter server db:seed

# 5. 配置部署密钥与 .env（部署人）
chmod 600 BJ_Baby_Care_Tracker.pem
cp docker/.env.example docker/.env
vi docker/.env   # 填 JWT_SECRET 等

# 6. 服务器首次初始化（已经做过，幂等）
pnpm server:bootstrap

# 7. 在 GitHub 仓库 Settings → Secrets 中配置（用于自动部署）
#    DEPLOY_HOST           = 152.136.125.185
#    DEPLOY_USER           = root
#    DEPLOY_PATH           = /opt/baby-care
#    DEPLOY_SSH_KEY        = <BJ_Baby_Care_Tracker.pem 全文>
#    TCR_USERNAME          = <腾讯云主账号 ID，纯数字，TCR 控制台可查>
#    TCR_PASSWORD          = <TCR 个人版 registry 密码（非腾讯云登录密码）>
#    DATABASE_URL          = file:/app/data/prod.db
#    JWT_SECRET            = <openssl rand -base64 48>
#    JWT_REFRESH_SECRET    = <openssl rand -base64 48>
#    CORS_ORIGIN           = *
#    OPENAI_API_KEY        = (可选，启用 AI 时必填)
#    OPENAI_BASE_URL       = https://tokenhub.tencentmaas.com/v1
#    OPENAI_MODEL          = hy3-preview
#    AI_DAILY_QUOTA        = 100
#    AI_FETCH_TIMEOUT_MS   = 30000
#    PATROL_ENABLED        = false
```

---

## 6. 日常开发循环

### 6.1 启动本地

```bash
pnpm dev          # 同时启动 client (5173) + server (3000)
# 或分开：
pnpm dev:server   # 只启动后端
pnpm dev:client   # 只启动前端
```

> Vite dev server 已配置 `/api → :3000` 代理（见 `client/vite.config.ts`）。

### 6.1.1 前端 Bundle 体积分析（v7.2+）

```bash
cd client
pnpm build            # 常规生产构建（不包含 visualizer）
pnpm build:analyze    # 等价于 ANALYZE=true pnpm build，额外产出 dist/stats.html
```

`build:analyze` 仅在 `ANALYZE=true` 环境变量下启用 `rollup-plugin-visualizer`，输出 treemap（含 gzip / brotli 大小）。普通构建保持精简，不引入分析插件。

**v7.2 起的体积纪律**（参见 `web-architecture.md §5.5`）：
- 应用入口 chunk gzip 应 ≤ **20 KB**（v7.2 实测 15.68 KB）
- 单个 page chunk gzip 应 ≤ **15 KB**（重图表页可放宽到 25 KB）
- vendor 组应保持稳定，新增大体积依赖前需评估是否新开 vendor chunk
- 提 PR 前如有大改动，本地跑一次 `pnpm build` 看体积变化作为 review 依据

### 6.2 修改 Prisma Schema

```bash
vi server/prisma/schema.prisma
pnpm db:migrate           # 生成 migration + 应用
# 或开发期不留迁移记录：
pnpm db:push
```

### 6.3 提交代码

```bash
git checkout -b feature/xxx
# ... 写代码 ...
git add -A && git commit -m "feat: ..."
git push -u origin feature/xxx
# 在 GitHub 上开 PR，等 CI 通过 + Code Review
```

### 6.4 Code Review 要点

参考 `coding-conventions.md`，Web 版补充：
- API 必须用 Zod schema 校验 body/query/params；
- Prisma 查询参数化，**禁止字符串拼接 SQL**；
- 前端调用接口必须经 `services/api.ts` 走拦截器；
- 新增/改动 ENV 变量必须同步 `docker/.env.example` 和 `deploy.yml`；

### 6.5 端到端测试（v5.0.0+）

> 详细场景参见 [`specs/web-feature-parity/e2e-scenarios.md`](../specs/web-feature-parity/e2e-scenarios.md)（35 个用例）；任务进度参见 [`specs/web-feature-parity/tasks.md`](../specs/web-feature-parity/tasks.md) 附录 A。

#### 测试栈

| 层级 | 框架 | 位置 | 跑法 |
|------|------|------|------|
| 后端 API | Vitest 4 + fetch | `server/tests/*.test.ts` | `pnpm test:api` |
| 浏览器 UI | Playwright + Chromium | `e2e/*.spec.ts` | `pnpm test:e2e` |
| 种子数据 | tsx 脚本 | `server/prisma/seed-e2e.ts` | `pnpm test:e2e:seed` / `:bulk` |

#### 测试账号池（共同密码 `Test1234!`）

| 代号 | 邮箱 | 角色 |
|------|------|------|
| U1 | u1.mom@e2e.local | FamilyA admin |
| U2 | u2.dad@e2e.local | FamilyA editor |
| U3 | u3.grandma@e2e.local | FamilyA viewer |
| U4 | u4.grandmaM@e2e.local | 未加入家庭（用于 S03 加入测试） |
| U5 | u5.guest@e2e.local | 未加入家庭（用于 S05 限流测试） |
| U6 | u6.momB@e2e.local | FamilyB admin（用于 S25 跨家庭隔离） |

#### 一次完整跑测

```bash
# Terminal 1：启服务
pnpm dev

# Terminal 2：跑后端 API 测试（自动 reset seed）
pnpm test:api

# Terminal 3：跑浏览器测试（自动 reset seed）
pnpm test:e2e

# 看 HTML 报告
pnpm test:e2e:report
```

#### 大数据量场景（S14 cursor 续传）

```bash
pnpm test:e2e:bulk    # 灌注 5000 条 records 到 babyA2
```

#### 已知 Bug 标记

测试套件中 `it.skip` / `test.skip` 标注的用例对应 `tasks.md` 附录 B 的真实代码 bug，修复后需同步去掉 `skip`。

#### CI 集成（v5.0.0 GA）

CI workflow（`.github/workflows/ci.yml`）应在 Phase 6 后追加：

```yaml
- name: Run API tests
  run: pnpm test:api
  env:
    DATABASE_URL: file:./test.db

- name: Run E2E tests
  run: |
    pnpm exec playwright install --with-deps chromium
    pnpm dev &
    npx wait-on http://localhost:3000/api/health http://localhost:5173
    pnpm test:e2e

- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: playwright-report
    path: playwright-report/
```

---

## 7. CI / CD 详解

### 7.1 CI（`.github/workflows/ci.yml`）

| Step | 作用 |
|---|---|
| `pnpm install` | 装依赖（缓存 pnpm store） |
| `prisma generate` | 生成 Prisma Client |
| `tsc -b` | 全量类型检查 |
| `build:client` / `build:server` | 验证可构建 |
| `docker build (smoke)` | 镜像构建可成功（不发布） |

任一失败则 PR 不能合并。

### 7.2 CD（`.github/workflows/deploy.yml`）

> **v1.1 起改为 registry 模式**：CI 把镜像 push 到腾讯云 TCR 个人版（`ccr.ccs.tencentyun.com/merlinjc/baby-care-tracker-3`），服务器从同生态 TCR 拉取，单次部署从 10+ 分钟缩到 2~3 分钟。

| Step | 说明 |
|---|---|
| 构建两个镜像 | `runtime`（server）+ `client-dist`（前端静态） |
| `docker login` TCR | 用 GitHub Secrets `TCR_USERNAME` / `TCR_PASSWORD` 登录 |
| `docker push` | 推送 `:<sha>` 与 `:latest`（client 版多带 `-client` 后缀） |
| `scp` 配置文件 | 仅传 `docker-compose.yml` / `nginx.conf`（小文件） |
| 渲染服务器 `.env` | 用 GitHub Secrets 注入；`IMAGE_REGISTRY=ccr.ccs.tencentyun.com/merlinjc/baby-care-tracker-3` |
| `docker compose pull + up -d` | 服务器从 TCR 拉取 + 滚动更新（同生态拉取秒级完成） |
| 健康检查 | `curl http://host/api/health`，最多 60 次（每 3s） |

**回滚**：在服务器 `/opt/baby-care/docker/.env` 修改 `IMAGE_TAG` 为上一版本（TCR 中需保留旧 tag），再 `docker compose --env-file .env up -d`。或在 GitHub Actions 手动触发 deploy 并填入旧 tag。

> ⚠️ TCR 个人版有镜像数量上限，按命名空间（默认 100 个 tag），定期清理旧 tag。可在 [TCR 控制台](https://console.cloud.tencent.com/tcr/repository) → 个人版 → 触发垃圾回收。

#### 7.2.1 部署耗时基线（v1.1 首跑实测，2026-05-06）

| Step | 首次推 TCR | 增量部署（预期） |
|---|---|---|
| Set up / checkout / buildx / login | 14s | 14s |
| Build & push **runtime** image | **15m 27s** | 2~4min |
| Build & push **client-dist** image | **2m 09s** | 1~2min |
| SSH + scp + render .env | 19s | 20s |
| **Pull & restart on server**（核心收益） | **27s** ⭐ | **20~40s** |
| Health check | < 1s | < 30s |
| **总计** | **≈ 18m 36s** | **≈ 4~7 min** |

> 对比 v1.0（ghcr.io）：服务器 pull 一步通常 5~15min，整体常 15~30+min。

**异常阈值**（连续两次部署超过以下值需要排查）：
- runtime build & push 增量超过 **8min** → 检查 GHA cache 命中率 / TCR 是否限流；
- pull & restart 超过 **3min** → 检查 Lighthouse → TCR 网络（同地域应秒级）；
- 总耗时超过 **15min** → 看 Actions 详细日志定位。

---

## 8. 应急部署（绕过 CI/CD）

当 GitHub Actions 不可用时（网络/账号原因）：

```bash
# 本机直接发布（自动走 docker build → save → scp → load → up）
pnpm deploy

# 跳过本地构建，重发已构建好的本地镜像
pnpm deploy:fast

# 指定 tag
./scripts/deploy.sh v1.2.0
```

**前置条件**：
- `docker/.env` 已正确配置；
- `BJ_Baby_Care_Tracker.pem` 在仓库根，权限 600；
- 本机能 docker build。

---

## 9. 远程运维

```bash
pnpm remote ps                # 查看容器状态
pnpm remote logs              # 全部日志
pnpm remote logs server       # 只看后端
pnpm remote restart server    # 重启后端
pnpm remote exec              # 进入 server 容器 shell
pnpm remote db                # 端口转发开 prisma studio (localhost:5555)
pnpm remote backup            # 立即备份 SQLite
pnpm remote health            # 跑一次健康检查
pnpm remote ssh               # 直接 SSH
```

底层都是基于 `BJ_Baby_Care_Tracker.pem`，无需记住命令细节。

---

## 10. 数据持久化与备份

| 数据 | 容器内路径 | Volume 名 | 说明 |
|---|---|---|---|
| SQLite | `/app/data/prod.db` | `baby-care_server_data` | 启动时自动同步 schema：有 `prisma/migrations/` 走 `migrate deploy`，无则走 `prisma db push`（当前 SQLite 阶段使用，幂等）|
| 上传文件 | `/app/uploads` | `baby-care_server_uploads` | 头像等 |
| 前端静态 | `/usr/share/nginx/html` | `baby-care_client_dist` | 每次部署被覆盖 |

**自动备份**：`/etc/cron.d/baby-care-backup`，每天 02:00 备份到 `/opt/baby-care/backups/db-YYYYMMDD.tar.gz`，保留 14 天。

**手动备份**：

```bash
pnpm remote backup
```

**恢复**：

```bash
pnpm remote ssh
cd /opt/baby-care
docker compose -f docker/docker-compose.yml stop server
docker run --rm -v baby-care_server_data:/data -v $PWD/backups:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/db-20260506.tar.gz -C /data"
docker compose -f docker/docker-compose.yml start server
```

---

## 11. 切换到 MySQL（未来升级路径）

`REFACTORING_PLAN.md` 中规划的 MySQL 迁移按以下步骤：

1. 修改 `server/prisma/schema.prisma`：`provider = "mysql"`；
2. 在 `docker-compose.yml` 增加 `mysql` 服务（参考 REFACTORING_PLAN §9.2）；
3. 修改 `docker/.env`：`DATABASE_URL=mysql://baby:PASS@mysql:3306/baby_care`；
4. 写迁移脚本：导出 SQLite → 写入 MySQL；
5. `pnpm deploy` 部署，启动时 `prisma migrate deploy` 会自动建表；

> **建议**：先在 develop 分支配一个独立的 docker-compose.dev.yml 跑通 MySQL，再合并主线。

---

## 12. 域名与 HTTPS

**生产域名**：`www.neo3.cn`（裸域 `neo3.cn` 301 → www）
**当前证书**：TrustAsia DV TLS RSA（腾讯云免费 SSL），覆盖 `neo3.cn` + `www.neo3.cn`，90 天有效期，需定期续签。

### 12.1 接入流程回顾（已完成）

1. **DNS（DNSPod）**：`www` A → `152.136.125.185`、`@`（裸域）A → `152.136.125.185`；
2. **云防火墙**：Lighthouse 控制台放通 TCP/443；
3. **证书上传**：
   ```bash
   scp -i BJ_Baby_Care_Tracker.pem \
     neo3.cn_nginx/neo3.cn_bundle.crt root@152.136.125.185:/opt/baby-care/docker/ssl/fullchain.pem
   scp -i BJ_Baby_Care_Tracker.pem \
     neo3.cn_nginx/neo3.cn.key        root@152.136.125.185:/opt/baby-care/docker/ssl/privkey.pem
   ssh ... "chmod 600 /opt/baby-care/docker/ssl/privkey.pem"
   ```
4. **nginx.conf**：
   - `server_name www.neo3.cn`（主站）、`neo3.cn`（301）、`default_server _`（80 全量 301）
   - TLS 1.2/1.3 + 现代 cipher suites + HTTP/2
   - HSTS 1 年 / CSP / X-Frame-Options / Referrer-Policy / X-Content-Type-Options
5. **docker-compose.yml**：暴露 `443:443` 端口、挂载 `./ssl:/etc/nginx/ssl:ro`
6. **CORS_ORIGIN**（GitHub Secret + server `.env`）：
   ```
   CORS_ORIGIN=https://www.neo3.cn,https://neo3.cn,http://152.136.125.185
   ```
   （后端 `server/src/middleware/cors.ts` 按逗号分隔解析）
7. **重启**：`docker compose --env-file .env up -d --force-recreate --no-deps nginx server`

### 12.2 301 与安全策略

| 来源 | 目的 | 说明 |
|---|---|---|
| `http://www.neo3.cn/*` | `https://www.neo3.cn/*` | 80 全量 301 |
| `http://neo3.cn/*`     | `https://www.neo3.cn/*` | 80 + 裸域 |
| `https://neo3.cn/*`    | `https://www.neo3.cn/*` | 443 裸域 server 块 |
| `http://152.136.125.185/*` | `https://www.neo3.cn/*` | IP 直访也跳域名（default_server） |

### 12.3 nginx `add_header` 继承坑

nginx 规则：**一个 `location` 块里一旦出现 `add_header`，会完全覆盖 `server` 级继承的 `add_header`**。本项目把 SPA fallback 的 `location /` 加了 `Cache-Control`，所以必须在该 location 里重复声明 HSTS / CSP / X-Frame-Options 等安全头，否则前端会完全失去这些保护。`/assets/` 同理。

### 12.4 证书续签（每 90 天）

TrustAsia 免费证书到期前：

1. 腾讯云控制台重新申请（同域名）
2. 重复 12.1 第 3 步：scp 新证书到服务器覆盖
3. `docker exec baby-care-nginx nginx -s reload`（无需重启容器）

### 12.5 备选：certbot 自动签发 Let's Encrypt

若要摆脱 90 天手动操作，可切换 certbot：

```bash
pnpm remote ssh
docker run --rm -v /opt/baby-care/ssl:/etc/letsencrypt \
  -p 80:80 certbot/certbot certonly --standalone -d www.neo3.cn -d neo3.cn
```
然后在 `docker-compose.yml` 增加 crontab 或 renew sidecar。

---

## 13. 常见问题（FAQ）

**Q1：`pnpm deploy` 卡在 docker build 里下载 npm 包**
A：受网络影响，可在 Dockerfile 的 deps 阶段加 `npmrc`：
```
RUN pnpm config set registry https://registry.npmmirror.com/
```

**Q2：服务器 2GB 内存不够 docker build？**
A：是的，**不要在服务器上构建**，要么本机构建（`pnpm deploy`），要么 GitHub Actions 构建。docker save/load 模式专门为此设计。

**Q3：怎么查看 Prisma 数据？**
A：`pnpm remote db` 会端口转发 5555 到本机，浏览器开 `http://localhost:5555` 即可。

**Q4：CORS 出问题？**
A：检查服务器 `docker/.env` 中的 `CORS_ORIGIN` 是否匹配前端 origin；同时检查 `server/src/middleware/cors.ts` 是否读取了该变量。

**Q5：发版后用户看到的还是老页面？**
A：Nginx 已对 `index.html` 设置 `no-cache`，对 `/assets/*`（带 hash）设置 1 年长缓存。如仍有问题，可在浏览器 DevTools 强制刷新；或在 `index.html` 加 `<meta http-equiv="Pragma" content="no-cache">`。

**Q6：怎么清理服务器上历史镜像？**
A：每次部署后 deploy.yml 会跑 `docker image prune -f`。手动清理：
```bash
pnpm remote ssh
docker image ls | grep baby-care
docker image rm baby-care-tracker-web:旧tag baby-care-tracker-web:旧tag-client
```

**Q7：CD 中 `docker login ccr.ccs.tencentyun.com` 401？**
A：检查 GitHub Secrets：
- `TCR_USERNAME` 必须是腾讯云**主账号 ID**（纯数字），不是子账号名也不是邮箱；
- `TCR_PASSWORD` 是 [TCR 控制台 → 个人版 → 访问凭证](https://console.cloud.tencent.com/tcr/user) 里设置的 registry 密码，**不是腾讯云登录密码**；
- 若忘记密码，可在控制台重置一次。

**Q8：服务器 pull 时报 `unauthorized`？**
A：服务器侧 `docker login` 凭证由 deploy.yml 在每次部署前重新写入。如手动在服务器上 pull，需先：
```bash
docker login ccr.ccs.tencentyun.com -u <主账号 ID>
```
TCR 个人版默认创建为 **私有仓库**，匿名 pull 会失败。

**Q9：TCR 个人版仓库满了怎么办？**
A：TCR 个人版按命名空间限 100 个 tag。在 [TCR 控制台](https://console.cloud.tencent.com/tcr/repository) → 个人版 → 触发垃圾回收，或考虑升级企业版。也可在 deploy.yml 增加 cleanup 步骤，调用 `tcr-toolkit` 删除 N 天前的 tag。

**Q10：注册/登录接口 500，日志报 `The table 'main.User' does not exist`？**
A：生产数据库 schema 没建表。本项目当前 **未维护 prisma migrations**（与 `pnpm db:push` 约定一致）。容器启动会按以下逻辑同步 schema：
- 若 `server/prisma/migrations/` 存在 → 走 `prisma migrate deploy`；
- 否则 → 走 `prisma db push --skip-generate --accept-data-loss`（幂等，不丢已有数据）。

如果你**首次部署后立刻翻车**，多半是用了老镜像（CMD 仍是 `migrate deploy`，但仓库里没 migrations 目录）。应急修复：
```bash
ssh -i BJ_Baby_Care_Tracker.pem root@152.136.125.185
docker exec -w /app/server baby-care-server npx prisma db push --skip-generate --accept-data-loss
docker exec baby-care-server sh -c 'apk add --no-cache sqlite >/dev/null 2>&1; sqlite3 /app/data/prod.db ".tables"'
```
之后重新构建并发布镜像（新 Dockerfile 已带 fallback），即可彻底闭环。

**Q11：注册/登录返回 `GET /api/auth/register 404`？**
A：你大概率是通过 `http://IP/`（HTTP + IP 直连）访问的 SPA。流程是：
1. 浏览器加载页面 → axios 用相对路径 `/api/auth/register` 发 POST；
2. 浏览器拼接 `http://IP/api/auth/register`；
3. nginx 80 端口把它跳到 `https://www.neo3.cn`；
4. 历史上 **301/302 会把 POST 转 GET 跟随**（且原 body 丢失）；
5. GET 命中 Express 路由没有 GET，返回 404。

修复：
- **正确做法**：用 `https://www.neo3.cn/...` 访问（域名 + HTTPS）；
- **服务端防御**：`docker/nginx.conf` 中 `/api/` 路径已改用 `308 Permanent Redirect` 而非 301，浏览器会保留 method/body 跟随。如果是从静态资源/页面跳转，仍用 301（更友好的缓存语义）。

---

## 14. 安全清单

- [x] SSH 密钥不入库（`*.pem` in `.gitignore`）
- [x] `.env` 不入库（`docker/.env` in `.gitignore`）
- [x] GitHub Secrets 持有所有生产密钥
- [x] Prisma 参数化查询（绝无 SQL 字符串拼接）
- [x] Helmet 中间件 + Nginx 安全头（X-Frame-Options 等）
- [x] JWT Access Token 短时（15 分钟）+ Refresh Token httpOnly cookie
- [x] generalRateLimit 中间件 + 后续可加 rate-limiter-flexible
- [ ] HTTPS（待域名就绪）
- [ ] 接入企业微信/飞书 webhook 通知部署结果
- [ ] 接入告警（CPU > 80% / 5xx > 阈值）

---

## 15. 维护责任

| 区域 | Owner | 备注 |
|---|---|---|
| `docker/` | DevOps | 版本变更需更新 README / 本文 |
| `.github/workflows/` | DevOps | Secrets 变更需同步本文 §5 |
| `scripts/deploy.sh` & `remote.sh` | DevOps | 与 deploy.yml 行为对齐 |
| `server/` `client/` | 全体 | 业务代码 |

---

> 📌 **变更协议**：本文档与 CI/CD 配置同源，**修改 workflow 必须同步更新本文**。
