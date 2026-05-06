import api from './api';
import type { AuthUser, LoginRequest, RegisterRequest, AuthResponse } from '@baby-care-tracker/shared';

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

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout', null, { withCredentials: true });
    } catch {
      // Ignore errors on logout
    }
  },
};

// Alias for compatibility with stores
export const authService = authApi;