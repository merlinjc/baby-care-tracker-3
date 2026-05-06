import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('邮箱格式无效').optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式无效').optional(),
  password: z.string()
    .min(8, '密码至少8位')
    .max(32, '密码最多32位')
    .regex(/[a-zA-Z]/, '密码需包含字母')
    .regex(/[0-9]/, '密码需包含数字'),
  nickname: z.string().min(1, '昵称不能为空').max(20, '昵称最多20字符'),
}).refine((data) => data.email || data.phone, {
  message: '邮箱和手机号至少提供一个',
});

export const loginSchema = z.object({
  email: z.string().email('邮箱格式无效').optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式无效').optional(),
  password: z.string().min(1, '密码不能为空'),
}).refine((data) => data.email || data.phone, {
  message: '邮箱和手机号至少提供一个',
});

export const updateProfileSchema = z.object({
  nickname: z.string().min(1, '昵称不能为空').max(20, '昵称最多20字符').optional(),
  avatar: z.string().url('头像URL格式无效').optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: z.string()
    .min(8, '新密码至少8位')
    .max(32, '新密码最多32位')
    .regex(/[a-zA-Z]/, '新密码需包含字母')
    .regex(/[0-9]/, '新密码需包含数字'),
});
