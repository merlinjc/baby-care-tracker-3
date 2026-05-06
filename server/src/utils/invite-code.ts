// 6-character invite code generator, excluding I/O/0/1 to avoid confusion
import { prisma } from '../config/database';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export function isValidInviteCodeFormat(code: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}

/**
 * 生成保证全局唯一的邀请码：随机生成 -> 查 DB -> 命中则重生成。
 * 由于字符集 32^6 ≈ 1.07B，碰撞概率极低，5 次重试足以兜底。
 *
 * @throws Error 5 次仍碰撞时抛错（理论几乎不可能）
 */
export async function generateUniqueInviteCode(maxRetries = 5): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateInviteCode();
    const existing = await prisma.family.findUnique({
      where: { inviteCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error('生成唯一邀请码失败：连续碰撞，请重试');
}
