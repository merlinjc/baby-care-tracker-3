import { z } from 'zod';

export const createFamilySchema = z.object({
  name: z.string().min(1, '家庭名称不能为空').max(30, '家庭名称最多30字符'),
  nickname: z.string().min(1, '昵称不能为空').max(20, '昵称最多20字符'),
  relation: z.string().max(20).optional(),
  relationText: z.string().max(20).optional(),
});

// 邀请码统一去空格 + 转大写后再校验，提升 UX
const inviteCodeField = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().length(6, '邀请码为6位').regex(/^[A-HJ-NP-Z2-9]{6}$/, '邀请码格式无效'));

export const joinFamilySchema = z.object({
  inviteCode: inviteCodeField,
  nickname: z.string().min(1, '昵称不能为空').max(20, '昵称最多20字符'),
  relation: z.string().max(20).optional(),
  relationText: z.string().max(20).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer'], { message: '无效的角色值' }),
});

export const transferAdminSchema = z.object({
  newAdminId: z.string().min(1, '新管理员ID不能为空'),
});

export const familyIdParamSchema = z.object({
  id: z.string().min(1, '家庭ID不能为空'),
});

export const familyMemberParamSchema = z.object({
  id: z.string().min(1, '家庭ID不能为空'),
  userId: z.string().min(1, '用户ID不能为空'),
});
