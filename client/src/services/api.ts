import axios from 'axios';
import { useAuthStore } from '@/stores/auth-store';
import { mapAxiosError } from '@/lib/api-error';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: auto refresh token on 401 + 统一映射后端错误为 ApiError 子类
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh for login/register endpoints
    if (error.response?.status === 401 && !originalRequest._retry) {
      const errorCode = error.response?.data?.error?.code;
      if (errorCode === 'TOKEN_EXPIRED') {
        originalRequest._retry = true;
        try {
          const { data } = await axios.post('/api/auth/refresh', null, {
            withCredentials: true,
          });
          const newToken = data.data.accessToken;
          useAuthStore.getState().setToken(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(error);
        }
      }
    }

    // FR-C6：将后端错误统一映射为 ApiError 子类（含 PermissionError / QuotaExceededError 等）
    return Promise.reject(mapAxiosError(error));
  }
);

export default api;
