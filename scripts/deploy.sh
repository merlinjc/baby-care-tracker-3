#!/usr/bin/env bash
# =============================================================================
#  Baby Care Tracker Web - 本地一键发布到 Lighthouse
#
#  流程：
#   1. 本地构建两个镜像（runtime + client-dist）
#   2. docker save 打包为 tar
#   3. scp 上传 + ssh 远程 docker load + compose up -d
#
#  用法：
#   ./scripts/deploy.sh                # 部署最新 commit
#   ./scripts/deploy.sh v1.2.0         # 指定 tag
#   FAST=1 ./scripts/deploy.sh         # 跳过本地构建，直接用已存在的本地镜像
# =============================================================================
set -euo pipefail

# ---- 加载部署配置 ----
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f docker/.env ]]; then
  echo "❌ 缺少 docker/.env，请先复制模板：cp docker/.env.example docker/.env"
  exit 1
fi
# shellcheck disable=SC1091
set -a; source docker/.env; set +a

DEPLOY_HOST="${DEPLOY_HOST:?DEPLOY_HOST not set}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/baby-care}"
SSH_KEY_PATH="${SSH_KEY_PATH:-./BJ_Baby_Care_Tracker.pem}"
# 本机应急部署走 docker save → scp → load，不经过 registry，
# 故强制使用本地短镜像名，避免与 CI 写入的 TCR 路径冲突。
IMAGE_REGISTRY="baby-care-tracker-web"

# Tag = 命令行参数 / git short sha / latest
TAG="${1:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
RUNTIME_IMAGE="${IMAGE_REGISTRY}:${TAG}"
CLIENT_IMAGE="${IMAGE_REGISTRY}:${TAG}-client"

SSH="ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST}"
SCP="scp -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 🚀 Baby Care Tracker Web - Deploy"
echo "    Host : ${DEPLOY_USER}@${DEPLOY_HOST}"
echo "    Path : ${DEPLOY_PATH}"
echo "    Tag  : ${TAG}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ============================================================================
#  Step 1. 本地构建
# ============================================================================
if [[ "${FAST:-0}" != "1" ]]; then
  echo ""
  echo "📦 [1/4] 构建运行时镜像 ${RUNTIME_IMAGE}"
  docker build \
    -f docker/Dockerfile \
    --target runtime \
    -t "${RUNTIME_IMAGE}" \
    -t "${IMAGE_REGISTRY}:latest" \
    .

  echo ""
  echo "📦 [1/4] 构建前端 dist 镜像 ${CLIENT_IMAGE}"
  docker build \
    -f docker/Dockerfile \
    --target client-dist \
    -t "${CLIENT_IMAGE}" \
    -t "${IMAGE_REGISTRY}:latest-client" \
    .
else
  echo "⏭️  跳过构建（FAST=1），使用已有镜像"
fi

# ============================================================================
#  Step 2. 打包镜像
# ============================================================================
echo ""
echo "📦 [2/4] 导出镜像 tar"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT
TAR_FILE="${TMP_DIR}/baby-care-${TAG}.tar"
docker save "${RUNTIME_IMAGE}" "${CLIENT_IMAGE}" -o "${TAR_FILE}"
echo "   导出大小: $(du -h "${TAR_FILE}" | awk '{print $1}')"

# ============================================================================
#  Step 3. 上传到服务器
# ============================================================================
echo ""
echo "🚢 [3/4] 上传到服务器"
$SSH "mkdir -p ${DEPLOY_PATH}/docker"

# 上传镜像 tar
$SCP "${TAR_FILE}" "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/baby-care-${TAG}.tar"

# 上传 compose / nginx / env
$SCP docker/docker-compose.yml "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/docker/docker-compose.yml"
$SCP docker/nginx.conf "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/docker/nginx.conf"
$SCP docker/.env "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/docker/.env"

# ============================================================================
#  Step 4. 远程加载镜像 + 重启服务
# ============================================================================
echo ""
echo "🔄 [4/4] 远程加载并重启服务"
$SSH bash -s <<EOF
set -euo pipefail
cd ${DEPLOY_PATH}

echo '  -> 加载镜像'
docker load -i baby-care-${TAG}.tar
rm -f baby-care-${TAG}.tar

# 把 IMAGE_REGISTRY / IMAGE_TAG 写进 .env（覆盖 CI 留下的 TCR 路径）
grep -q '^IMAGE_REGISTRY=' docker/.env && \
  sed -i "s|^IMAGE_REGISTRY=.*|IMAGE_REGISTRY=${IMAGE_REGISTRY}|" docker/.env || \
  echo "IMAGE_REGISTRY=${IMAGE_REGISTRY}" >> docker/.env
grep -q '^IMAGE_TAG=' docker/.env && \
  sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${TAG}|" docker/.env || \
  echo "IMAGE_TAG=${TAG}" >> docker/.env

echo '  -> 拉起服务'
cd docker
# 镜像已 load 到本地，跳过 pull（pull 失败不影响）
docker compose --env-file .env pull 2>/dev/null || true
docker compose --env-file .env up -d --remove-orphans

echo '  -> 等待健康检查'
for i in \$(seq 1 30); do
  if curl -fsS http://127.0.0.1/healthz >/dev/null 2>&1 && \
     curl -fsS http://127.0.0.1/api/health >/dev/null 2>&1; then
    echo "  ✅ 服务已就绪"
    exit 0
  fi
  sleep 2
done
echo "  ❌ 健康检查超时，请查看日志：docker compose logs --tail=100"
exit 1
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ✅ 部署成功"
echo "    访问：http://${DEPLOY_HOST}/"
echo "    健康：http://${DEPLOY_HOST}/api/health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
