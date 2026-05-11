import { Outlet, NavLink, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Clipboard, Compass, Home, User, UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import { useFamilyStore } from '@/stores/family-store';
import { useBabyStore } from '@/stores/baby-store';
import { Footer } from '@/components/footer';
import type { Baby } from '@/types';
import { getAgeLabel } from '@/lib/date';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Avatar, BabyAvatar } from '@/components/ui/avatar';

/**
 * 导航项静态结构 — label 不在这里写死，改在渲染时通过 t() 取，
 * 避免组件外的对象引用导致 i18n 切换不刷新。
 */
const navItems = [
  { to: '/', icon: Home, labelKey: 'tabs.home' as const },
  { to: '/record', icon: Clipboard, labelKey: 'tabs.record' as const },
  { to: '/discover', icon: Compass, labelKey: 'tabs.discover' as const },
  { to: '/profile', icon: UserCircle, labelKey: 'tabs.profile' as const },
];

/**
 * SidebarBabyCard v7 — 桌面 Sidebar 底部当前宝宝卡（iOS 风圆润）
 */
function SidebarBabyCard() {
  const { t } = useTranslation('nav');
  const babies = useBabyStore((s) => s.babies);
  const currentBaby = useBabyStore((s) => s.currentBaby);
  const selectBaby = useBabyStore((s) => s.selectBaby);
  const queryClient = useQueryClient();

  if (babies.length === 0) return null;

  const handleSelect = (baby: Baby) => {
    selectBaby(baby.id);
    queryClient.invalidateQueries({ queryKey: ['todayStats', baby.id] });
    queryClient.invalidateQueries({ queryKey: ['records', baby.id] });
    queryClient.invalidateQueries({ queryKey: ['activeSleep', baby.id] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5',
            'rounded-[14px] transition-colors',
            'bg-[var(--surface-2)] hover:bg-[var(--surface-hover)]',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]',
          )}
        >
          {currentBaby ? (
            <>
              <BabyAvatar baby={currentBaby} size="md" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[14px] font-semibold text-[var(--label)] truncate">
                  {currentBaby.name}
                </p>
                <p className="text-[12px] text-[var(--label-tertiary)] truncate">
                  {getAgeLabel(currentBaby.birthDate)}
                </p>
              </div>
            </>
          ) : (
            <>
              <Avatar size="md">
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ backgroundColor: 'var(--surface-hover)' }}
                >
                  <User className="h-4 w-4" style={{ color: 'var(--label-tertiary)' }} />
                </div>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[14px] font-semibold text-[var(--label-secondary)]">
                  {t('sidebar.select_baby')}
                </p>
                <p className="text-[12px] text-[var(--label-tertiary)]">
                  {t('sidebar.babies_available', { count: babies.length })}
                </p>
              </div>
            </>
          )}
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: 'var(--label-tertiary)' }}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="min-w-[220px] max-h-72 overflow-y-auto"
      >
        {babies.map((baby) => {
          const isCurrent = baby.id === currentBaby?.id;
          return (
            <DropdownMenuItem key={baby.id} onSelect={() => handleSelect(baby)}>
              <BabyAvatar baby={baby} size="sm" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[14px] text-[var(--label)] truncate">{baby.name}</p>
                <p className="text-[12px] text-[var(--label-tertiary)] truncate">
                  {getAgeLabel(baby.birthDate)}
                </p>
              </div>
              {isCurrent && (
                <Check className="h-4 w-4 shrink-0" style={{ color: 'var(--brand)' }} />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * MainLayout v7 — iOS 风主框架
 *
 * 关键改造：
 * - 桌面 Sidebar：圆角 Brand Logo + 激活态 tinted filled + spring icon
 * - 移动端 TabBar：iOS 标准 hairline 分隔 + 激活色 --brand + bold icon 切换
 * - 内容区默认 surface-0 底
 *
 * v7.2 F8-02：4 个 NavLink label 与 SidebarBabyCard 文案接入 i18n（nav 命名空间）。
 * "Baby Care" 作为品牌名保留英文。
 */
export function MainLayout() {
  const { t } = useTranslation('nav');
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
    <div className="flex min-h-screen bg-[var(--surface-0)]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0',
          'bg-[var(--surface-1)]',
          'border-r border-[var(--separator)]',
        )}
      >
        {/* Brand Logo */}
        <div className="flex items-center h-16 px-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-ink) 100%)',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <span className="text-white text-[16px] font-bold">B</span>
            </div>
            <h1 className="text-[18px] font-bold tracking-tight text-[var(--label)]">
              Baby Care
            </h1>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-[10px]',
                  'text-[15px] font-semibold',
                  'transition-colors duration-150',
                  isActive
                    ? 'bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-ink)]'
                    : 'text-[var(--label-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--label)]',
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: Baby card + version */}
        <div className="px-3 pb-4 space-y-2 pt-3 border-t border-[var(--separator)]">
          <SidebarBabyCard />
          <p className="text-[11px] text-center text-[var(--label-tertiary)] font-medium">
            v7.0
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main data-app-main className="flex-1 lg:ml-60 pb-20 lg:pb-0 flex flex-col">
        <div data-app-content className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-6 py-6 lg:py-8">
          <Outlet />
        </div>
        <Footer />
      </main>

      {/* Mobile TabBar — iOS 风 hairline + 激活态 */}
      <nav
        data-app-tabbar
        className={cn(
          'lg:hidden fixed bottom-0 left-0 right-0 z-50',
          'bg-[var(--surface-1)]/92 backdrop-blur-xl',
          'border-t border-[var(--separator)]',
        )}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div data-app-tabbar-inner className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5',
                  'flex-1 h-full transition-colors',
                  isActive ? 'text-[var(--brand-ink)]' : 'text-[var(--label-tertiary)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <motion.div
                    animate={isActive ? { scale: 1.08 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <item.icon className="w-6 h-6" />
                  </motion.div>
                  <span
                    className={cn(
                      'text-[10px] transition-all',
                      isActive ? 'font-semibold' : 'font-medium',
                    )}
                  >
                    {t(item.labelKey)}
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
