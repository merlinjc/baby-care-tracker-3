import { Outlet, NavLink } from 'react-router-dom';
import { Home, ClipboardList, Compass, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useFamilyStore } from '@/stores/family-store';
import { useBabyStore } from '@/stores/baby-store';

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/record', icon: ClipboardList, label: '记录' },
  { to: '/discover', icon: Compass, label: '发现' },
  { to: '/profile', icon: User, label: '我的' },
];

export function MainLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const family = useFamilyStore((s) => s.family);
  const loadFamily = useFamilyStore((s) => s.loadFamily);
  const loadBabies = useBabyStore((s) => s.loadBabies);

  useEffect(() => {
    if (isAuthenticated) {
      loadFamily();
      if (family?.id) {
        loadBabies(family.id);
      }
    }
  }, [isAuthenticated, loadFamily, loadBabies]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-[var(--bg-secondary)] border-r border-[var(--border)]">
        <div className="flex items-center h-16 px-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div
              className="icon-circle icon-circle--sm"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <span className="text-white text-xs font-bold">B</span>
            </div>
            <h1 className="heading-md text-[var(--primary-dark)]">Baby Care</h1>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl body-md font-medium transition-all',
                  isActive
                    ? 'bg-[color-mix(in_srgb,_var(--primary)_12%,_transparent)] text-[var(--primary-dark)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 pb-4">
          <p className="caption text-center">v4.3</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-60 pb-16 lg:pb-0">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile TabBar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)] border-t border-[var(--border)] z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                  isActive ? 'text-[var(--primary-dark)]' : 'text-[var(--text-hint)]'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <item.icon className={cn('w-5 h-5 transition-all', isActive && 'scale-110')} strokeWidth={isActive ? 2.5 : 2} />
                    {isActive && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--primary)]" />
                    )}
                  </div>
                  <span className={cn('transition-all', isActive ? 'text-[10px] font-semibold' : 'text-[10px] font-medium')}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
