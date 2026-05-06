import { Outlet, NavLink } from 'react-router-dom';
import { Home, ClipboardList, Compass, User, Check, ChevronsUpDown, Baby as BabyIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { Navigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFamilyStore } from '@/stores/family-store';
import { useBabyStore } from '@/stores/baby-store';
import { Footer } from '@/components/footer';
import type { Baby } from '@/types';
import { getAgeLabel } from '@/lib/date';

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/record', icon: ClipboardList, label: '记录' },
  { to: '/discover', icon: Compass, label: '发现' },
  { to: '/profile', icon: User, label: '我的' },
];

/**
 * SidebarBabyCard - 桌面 Sidebar 底部的"当前宝宝"卡
 * 点击展开下拉列表，切换宝宝。
 */
function SidebarBabyCard() {
  const babies = useBabyStore((s) => s.babies);
  const currentBaby = useBabyStore((s) => s.currentBaby);
  const selectBaby = useBabyStore((s) => s.selectBaby);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (babies.length === 0) {
    return null;
  }

  const handleSelect = (baby: Baby) => {
    selectBaby(baby.id);
    queryClient.invalidateQueries({ queryKey: ['todayStats', baby.id] });
    queryClient.invalidateQueries({ queryKey: ['records', baby.id] });
    queryClient.invalidateQueries({ queryKey: ['activeSleep', baby.id] });
    setOpen(false);
  };

  const avatarBg = (baby: Baby) =>
    baby.gender === 'female' ? 'var(--temperature)' : 'var(--growth)';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors',
          'border border-[var(--border-light)] bg-[var(--bg-card)] hover:border-[var(--primary)]'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {currentBaby ? (
          <>
            {currentBaby.avatar ? (
              <img
                src={currentBaby.avatar}
                alt={currentBaby.name}
                className="h-9 w-9 rounded-full object-cover shrink-0"
              />
            ) : (
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                style={{ background: avatarBg(currentBaby) }}
              >
                {currentBaby.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="body-md font-medium text-[var(--text-primary)] truncate">
                {currentBaby.name}
              </p>
              <p className="caption truncate">{getAgeLabel(currentBaby.birthDate)}</p>
            </div>
          </>
        ) : (
          <>
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <BabyIcon className="h-4 w-4" style={{ color: 'var(--text-hint)' }} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="body-md font-medium text-[var(--text-secondary)]">选择宝宝</p>
              <p className="caption">{babies.length} 位可选</p>
            </div>
          </>
        )}
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-hint)' }} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full left-0 right-0 mb-2 rounded-xl p-1 shadow-popup overflow-hidden animate-fade-in-up"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {babies.map((baby) => {
            const isCurrent = baby.id === currentBaby?.id;
            return (
              <button
                key={baby.id}
                type="button"
                role="option"
                aria-selected={isCurrent}
                onClick={() => handleSelect(baby)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors',
                  isCurrent ? 'bg-[var(--bg-elevated)]' : 'hover:bg-[var(--bg-elevated)]'
                )}
              >
                {baby.avatar ? (
                  <img
                    src={baby.avatar}
                    alt={baby.name}
                    className="h-8 w-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                    style={{ background: avatarBg(baby) }}
                  >
                    {baby.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="body-md text-[var(--text-primary)] truncate">{baby.name}</p>
                  <p className="caption truncate">{getAgeLabel(baby.birthDate)}</p>
                </div>
                {isCurrent && (
                  <Check className="h-4 w-4 shrink-0" style={{ color: 'var(--primary)' }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  }, [isAuthenticated, family?.id, loadFamily, loadBabies]);

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
        <div className="px-3 pb-3 space-y-2 border-t border-[var(--border)] pt-3">
          <SidebarBabyCard />
          <p className="caption text-center">v4.3</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-60 pb-16 lg:pb-0 flex flex-col">
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
          <Outlet />
        </div>
        <Footer />
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
