import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { Navigate } from 'react-router-dom';
import { Baby } from 'lucide-react';

export function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--primary)' }}>
            <Baby className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Baby Care Tracker</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>记录宝宝成长的每一天</p>
        </div>
        <div className="card">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
