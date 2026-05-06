#!/usr/bin/env bash
# =============================================================================
#  Baby Care Tracker Web - 服务器首次初始化
#  在本机执行（自动 ssh 到服务器完成 bootstrap）
#
#  作用：
#   - 创建 /opt/baby-care 目录骨架
#   - 验证 docker / docker compose 可用
#   - 配置防火墙开放 80/443（如必要）
#   - 创建数据目录与 .env 占位
#
#  幂等：可重复执行
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f docker/.env ]]; then
  echo "❌ 缺少 docker/.env，请先 cp docker/.env.example docker/.env 并填好密钥"
  exit 1
fi
# shellcheck disable=SC1091
set -a; source docker/.env; set +a

DEPLOY_HOST="${DEPLOY_HOST:?DEPLOY_HOST not set}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/baby-care}"
SSH_KEY_PATH="${SSH_KEY_PATH:-./BJ_Baby_Care_Tracker.pem}"

# 修正密钥权限
chmod 600 "${SSH_KEY_PATH}"

SSH="ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST}"

echo "🔧 Bootstrap ${DEPLOY_USER}@${DEPLOY_HOST} -> ${DEPLOY_PATH}"

$SSH bash -s <<EOF
set -euo pipefail

echo '  -> 校验 Docker 环境'
docker --version
docker compose version

echo '  -> 创建目录骨架'
mkdir -p ${DEPLOY_PATH}/docker
mkdir -p ${DEPLOY_PATH}/backups
mkdir -p ${DEPLOY_PATH}/logs

echo '  -> 创建专用 docker network（若不存在）'
docker network inspect baby-care_baby_net >/dev/null 2>&1 || \
  docker network create baby-care_baby_net 2>/dev/null || true

echo '  -> 防火墙放通 80/443（firewalld 如果存在）'
if command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
  firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || true
  firewall-cmd --reload 2>/dev/null || true
fi

echo '  -> 配置每日 02:00 备份 SQLite（cron）'
cat > /etc/cron.d/baby-care-backup <<'CRON'
0 2 * * * root /usr/bin/docker run --rm -v baby-care_server_data:/data -v ${DEPLOY_PATH}/backups:/backup alpine sh -c "tar czf /backup/db-\$(date +\\%Y\\%m\\%d).tar.gz -C /data . && find /backup -name 'db-*.tar.gz' -mtime +14 -delete"
CRON

echo '  ✅ 服务器初始化完成'
echo '     目录: ${DEPLOY_PATH}'
echo '     下一步：在本地运行 ./scripts/deploy.sh'
EOF
