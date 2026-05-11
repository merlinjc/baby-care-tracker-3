/**
 * checkin-date.ts - 服务端打卡日期工具（v7.2 T-S2-F11-BE-02）
 *
 * 与 `client/src/lib/daily-checkin-date.ts` 中同名工具语义一致，
 * 但仅复刻服务端用得到的最小子集（窗口校验 + ymd 合法性 + 当天）。
 *
 * **关键约束**：服务端的 "今天" 取决于 Node 进程时区。
 * 我们假设服务端时区与用户预期一致（容器部署时通过 TZ 环境变量统一为 Asia/Shanghai）。
 * 客户端写入 `checkinDate` 时已用本地时区，服务端按字符串比较即可，**不做时区换算**。
 *
 * 之所以不直接 import client 的同名 lib：
 * - server tsconfig include 只覆盖 src + ../shared，跨 client 引入会破坏构建
 * - 这里只用到 4 个函数，复刻成本低
 * - lib 形态简单，前后端漂移风险小（被 daily-checkin-date.test.ts 28 用例 + 此处单测共同保障）
 */

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmd(ymd: string): boolean {
  if (!YMD_PATTERN.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

export function todayLocalYmd(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 是否落在 [today-7d, today] 补打卡窗口内（含两端）。
 * 未来日期 / 8 天前 / 非法 ymd 均返回 false。
 */
export function isWithinCheckinWindow(ymd: string, now: Date = new Date()): boolean {
  if (!isValidYmd(ymd)) return false;
  const today = ymdToLocalDate(todayLocalYmd(now));
  const target = ymdToLocalDate(ymd);
  if (target.getTime() > today.getTime()) return false;
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000),
  );
  return diffDays >= 0 && diffDays <= 7;
}
