#!/usr/bin/env bash
# =============================================================================
#  Baby Care Tracker Web - 远程运维快捷脚本
#
#  用法：
#    ./scripts/remote.sh logs            # 实时日志
#    ./scripts/remote.sh logs server     # 仅看 server 日志
#    ./scripts/remote.sh ps              # 容器状态
#    ./scripts/remote.sh restart         # 重启全部
#    ./scripts/remote.sh restart server  # 仅重启 server
#    ./scripts/remote.sh exec            # 进入 server 容器 shell
#    ./scripts/remote.sh db              # 打开 prisma studio (端口转发到本地 5555)
#    ./scripts/remote.sh backup          # 立即触发 SQLite 备份
#    ./scripts/remote.sh ssh             # 直接 SSH 登录
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f docker/.env ]]; then
  echo "❌ 缺少 docker/.env，请先 cp docker/.env.example docker/.env"
  exit 1
fi
# shellcheck disable=SC1091
set -a; source docker/.env; set +a

DEPLOY_HOST="${DEPLOY_HOST:?DEPLOY_HOST not set}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/baby-care}"
SSH_KEY_PATH="${SSH_KEY_PATH:-./BJ_Baby_Care_Tracker.pem}"
SSH="ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST}"

ACTION="${1:-help}"
TARGET="${2:-}"

case "$ACTION" in
  logs)
    $SSH "cd ${DEPLOY_PATH}/docker && docker compose logs -f --tail=200 ${TARGET}"
    ;;
  ps)
    $SSH "cd ${DEPLOY_PATH}/docker && docker compose ps"
    ;;
  restart)
    $SSH "cd ${DEPLOY_PATH}/docker && docker compose restart ${TARGET}"
    ;;
  stop)
    $SSH "cd ${DEPLOY_PATH}/docker && docker compose down"
    ;;
  exec)
    $SSH -t "cd ${DEPLOY_PATH}/docker && docker compose exec server sh"
    ;;
  db)
    echo "🔗 端口转发 5555:5555 到服务器，浏览器打开 http://localhost:5555"
    $SSH -L 5555:localhost:5555 -t "cd ${DEPLOY_PATH}/docker && docker compose exec server npx prisma studio --port 5555 --hostname 0.0.0.0"
    ;;
  backup)
    $SSH "docker run --rm -v baby-care_server_data:/data -v ${DEPLOY_PATH}/backups:/backup alpine sh -c 'tar czf /backup/db-manual-\$(date +%Y%m%d-%H%M%S).tar.gz -C /data .' && ls -lh ${DEPLOY_PATH}/backups | tail -n 5"
    ;;
  ssh)
    $SSH
    ;;
  health)
    echo "🩺 Health check"
    $SSH "curl -fsS http://127.0.0.1/healthz && echo && curl -fsS http://127.0.0.1/api/health"
    ;;
  *)
    grep -E '^#  ' "$0" | sed 's/^#  //'
    ;;
esac
