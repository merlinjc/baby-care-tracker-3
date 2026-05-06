import api from './api';
import type { AuthUser, LoginRequest, RegisterRequest, AuthResponse } from '@baby-care-tracker/shared';
import type { WechatLoginRequest } from './wechat-auth';

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const res = await api.post('/auth/login', data);
    return res.data.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const res = await api.post('/auth/register', data);
    return res.data.data;
  },

  refresh: async (): Promise<{ accessToken: string }> => {
    const res = await api.post('/auth/refresh', null, { withCredentials: true });
    return res.data.data;
  },

  getMe: async (): Promise<AuthUser> => {
    const res = await api.get('/auth/me');
    return res.data.data.user;
  },

  updateProfile: async (data: { nickname?: string; avatar?: string }): Promise<AuthUser> => {
    const res = await api.patch('/auth/profile', data);
    return res.data.data.user;
  },

  changePassword: async (data: { oldPassword: string; newPassword: string }): Promise<void> => {
    await api.post('/auth/change-password', { currentPassword: data.oldPassword, newPassword: data.newPassword });
  },

  /**
   * 主动注销：让后端清除 httpOnly refreshToken cookie。
   * 后端未实现该端点时安全降级为本地登出（auth-store.logout）。
   */
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout', null, { withCredentials: true });
    } catch {
      // 后端未实现 / 网络异常都不阻塞前端登出
    }
  },

  /**
   * 微信扫码登录：用回调拿到的 code 兑换我方 JWT。
   * 对应后端 POST /api/auth/wechat（详见 docs/web-api-spec.md §2.7）。
   */
  loginWithWechat: async (data: WechatLoginRequest): Promise<AuthResponse> => {
    const res = await api.post('/auth/wechat', data);
    return res.data.data;
  },
};

// Alias for compatibility with stores
export const authService = authApi;
