import { useNavigate } from 'react-router-dom'
import { Users, Baby, Settings, ChevronRight, LogOut, Download } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useBabyStore } from '@/stores/baby-store'
import { useFamilyStore } from '@/stores/family-store'
import { authService } from '@/services/auth'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useState } from 'react'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const family = useFamilyStore((s) => s.family)
  const currentBaby = useBabyStore((s) => s.currentBaby)
  const babies = useBabyStore((s) => s.babies)
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    const ok = await confirm({
      title: '退出登录？',
      description: '退出后需重新登录才能访问应用。',
      confirmText: '确认退出',
      variant: 'danger',
    })
    if (!ok) return
    setIsLoggingOut(true)
    try {
      await authService.logout()
      logout()
      navigate('/login')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const initial = (user?.nickname || user?.email || '?').charAt(0).toUpperCase()

  /** 快捷入口配置 */
  const menuItems: {
    to: string
    icon: typeof Users
    label: string
    detail?: string
    color: string
  }[] = [
    {
      to: '/baby',
      icon: Baby,
      label: '宝宝管理',
      detail: babies.length > 0 ? `${babies.length} 位` : '未添加',
      color: 'var(--primary)',
    },
    {
      to: '/family',
      icon: Users,
      label: '家庭管理',
      detail: family?.name ?? '未加入',
      color: 'var(--sleep)',
    },
    {
      to: '/settings?tab=export',
      icon: Download,
      label: '数据导出',
      color: 'var(--temperature)',
    },
    {
      to: '/settings',
      icon: Settings,
      label: '设置',
      color: 'var(--text-hint)',
    },
  ]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 animate-fade-in-up">
      {/* 用户卡（放大版） */}
      <div className="card flex items-center gap-4">
        <div
          className="rounded-full flex items-center justify-center shrink-0"
          style={{
            width: 64,
            height: 64,
            backgroundColor: 'var(--primary)',
          }}
        >
          <span
            className="text-white font-display font-semibold"
            style={{ fontSize: 'var(--text-2xl)' }}
          >
            {initial}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="heading-md text-[var(--text-primary)] truncate">
            {user?.nickname || '未登录'}
          </h2>
          <p className="body-sm text-[var(--text-hint)] truncate">{user?.email || ''}</p>
          {currentBaby && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span
                className="badge-mini"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                  color: 'var(--primary)',
                }}
              >
                <Baby className="h-3 w-3" />
                {currentBaby.name}
              </span>
              {family && (
                <span
                  className="badge-mini"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--sleep) 12%, transparent)',
                    color: 'var(--sleep)',
                  }}
                >
                  {family.name}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 快捷入口分组列表（iOS 分组 Cell 风格） */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
        }}
      >
        {menuItems.map((item, idx) => (
          <button
            key={item.to}
            type="button"
            onClick={() => navigate(item.to)}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)]"
            style={{
              borderTop: idx === 0 ? undefined : '1px solid var(--border-light)',
            }}
          >
            <div
              className="icon-circle icon-circle--sm"
              style={{
                backgroundColor: `color-mix(in srgb, ${item.color} 12%, transparent)`,
              }}
            >
              <item.icon className="h-4 w-4" style={{ color: item.color }} />
            </div>
            <span className="body-md text-[var(--text-primary)] flex-1 text-left">
              {item.label}
            </span>
            {item.detail && (
              <span className="caption text-[var(--text-hint)] truncate max-w-[140px]">
                {item.detail}
              </span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text-hint)' }} />
          </button>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="btn-danger-outline w-full"
      >
        <LogOut className="h-4 w-4" />
        {isLoggingOut ? '退出中...' : '退出登录'}
      </button>
    </div>
  )
}
