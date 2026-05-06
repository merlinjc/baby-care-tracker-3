import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, Baby, Settings, ChevronRight, Moon, Sun, Monitor, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore } from '@/stores/theme-store'
import { useBabyStore } from '@/stores/baby-store'
import { useFamilyStore } from '@/stores/family-store'
import { authService } from '@/services/auth'
import { Dialog } from '@/components/ui/dialog'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const family = useFamilyStore((s) => s.family)
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const { mode, setMode } = useThemeStore()
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await authService.logout()
      logout()
      navigate('/login')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: '亮色' },
    { value: 'warm-night' as const, icon: Moon, label: '暖夜' },
    { value: 'system' as const, icon: Monitor, label: '跟随系统' },
  ]

  const initial = (user?.nickname || user?.email || '?').charAt(0).toUpperCase()

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 animate-fade-in-up">
      {/* User Card with current baby info merged */}
      <div className="card-base flex items-center gap-4">
        <div
          className="icon-circle icon-circle--lg"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <span className="text-white font-display font-semibold" style={{ fontSize: 'var(--text-xl)' }}>
            {initial}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="heading-md text-[var(--text-primary)] truncate">{user?.nickname || '未登录'}</h2>
          <p className="body-sm text-[var(--text-hint)] truncate">{user?.email || ''}</p>
          {currentBaby && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Baby className="h-3 w-3" style={{ color: 'var(--primary)' }} />
              <span className="caption" style={{ color: 'var(--primary)' }}>
                {currentBaby.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Theme Selector - stable border (no jumping) */}
      <div className="card-base">
        <p className="label-base mb-3">主题模式</p>
        <div className="flex gap-2">
          {themeOptions.map((opt) => {
            const isActive = mode === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className="flex-1 flex flex-col items-center gap-2 p-3 rounded-xl transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-primary)',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-light)'}`,
                }}
                aria-pressed={isActive}
              >
                <opt.icon className="h-5 w-5" />
                <span className="body-sm font-medium">{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick Links */}
      <div className="space-y-2 stagger-children">
        {[
          { to: '/baby', icon: Baby, label: '宝宝管理', color: 'var(--primary)' },
          { to: '/family', icon: Users, label: `家庭${family ? ` · ${family.name}` : ''}`, color: 'var(--sleep)' },
          { to: '/settings', icon: Settings, label: '设置', color: 'var(--text-hint)' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="card-interactive flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div
                className="icon-circle icon-circle--sm"
                style={{ backgroundColor: `color-mix(in srgb, ${item.color} 12%, transparent)` }}
              >
                <item.icon className="h-4 w-4" style={{ color: item.color }} />
              </div>
              <span className="body-md text-[var(--text-primary)]">{item.label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-hint)]" />
          </Link>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={() => setShowLogoutConfirm(true)}
        className="btn-danger-outline w-full"
      >
        <LogOut className="h-4 w-4" />
        退出登录
      </button>

      {/* Logout confirmation dialog */}
      <Dialog
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="退出登录"
        icon={<LogOut className="h-4 w-4" />}
        accentColor="var(--danger)"
      >
        <div className="space-y-4">
          <p className="body-md text-[var(--text-secondary)]">
            确定要退出登录吗？退出后需重新登录才能访问应用。
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(false)}
              className="btn-secondary flex-1"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="btn-primary flex-1"
              style={{ backgroundColor: 'var(--danger)' }}
            >
              {isLoggingOut ? '退出中...' : '确认退出'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
