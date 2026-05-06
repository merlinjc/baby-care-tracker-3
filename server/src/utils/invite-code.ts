// 6-character invite code generator, excluding I/O/0/1 to avoid confusion
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
