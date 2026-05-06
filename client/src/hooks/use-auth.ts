import { useAuthStore } from '@/stores/auth-store';
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

export function useAuth() {
  const store = useAuthStore();
  const navigate = useNavigate();

  const loginAndRedirect = useCallback(async (email: string, password: string) => {
    await store.login({ email, password });
    navigate('/');
  }, [store, navigate]);

  const registerAndRedirect = useCallback(async (email: string, password: string, nickname: string) => {
    await store.register(email, password, nickname);
    navigate('/');
  }, [store, navigate]);

  const logoutAndRedirect = useCallback(() => {
    store.logout();
    navigate('/login');
  }, [store, navigate]);

  return {
    ...store,
    loginAndRedirect,
    registerAndRedirect,
    logoutAndRedirect,
  };
}
