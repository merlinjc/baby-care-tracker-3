import api from './api';
import type {
  AuthUser,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  UserPreferences,
} from '@baby-care-tracker/shared';
import type { WechatLoginRequest } from './wechat-auth';

/**
 * PATCH /auth/profile 请求体（v7.2+ T-S1-INF-01 起支持 preferences）
 *
 * - nickname / avatar：传统字段，保持向后兼容
 * - preferences：顶层 key 级深合并语义，部分更新即可（详见 shared/types UserPreferences）
 */
export interface UpdateProfileRequest {
  nickname?: string;
  avatar?: string | null;
  preferences?: Partial<UserPreferences>;
}

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

  updateProfile: async (data: UpdateProfileRequest): Promise<AuthUser> => {
    const res = await api.patch('/auth/profile', data);
    return res.data.data.user;
  },

  /**
   * 便捷方法：仅更新 preferences（部分字段）。
   * 等价于 `updateProfile({ preferences: patch })`，但语义更明确，
   * 业务调用方（F1 引导 / F8 i18n / 主题 / 字体档跨设备种子）请优先使用本方法。
   */
  updatePreferences: async (patch: Partial<UserPreferences>): Promise<AuthUser> => {
    const res = await api.patch('/auth/profile', { preferences: patch });
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

