/**
 * 邀请码生成（v4.3.0 FR-7 迁移自原 familyOperation/index.js）
 * 排除易混淆字符 I / O / 0 / 1
 */

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = { generateInviteCode };
