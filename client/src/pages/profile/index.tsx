import { useNavigate } from 'react-router-dom'
import { Users, Baby, Settings, ChevronRight, LogOut, Download, Palette, Type } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useBabyStore } from '@/stores/baby-store'
import { useFamilyStore } from '@/stores/family-store'
import { authService } from '@/services/auth'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { ThemeSelector } from '@/components/theme-selector'
import { FontScaleSelector } from '@/components/font-scale-selector'
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
    // v5.0.0+：用 data-profile-stack 作为 CSS 兜底钩子，避免 Tailwind 4 JIT
    // 偶发漏扫导致 space-y-* 失效时各模块挤在一起（与 MainLayout 同样的防御思路）。
    <div data-profile-stack className="space-y-6 animate-fade-in-up">
      {/* 用户卡（放大版） */}
      <Card className="flex items-center gap-4">
        <UserAvatar user={{ nickname: user?.nickname, avatar: null }} size="xl" />
        <div className="flex-1 min-w-0">
          <h2 className="heading-md text-[var(--text-primary)] truncate">
            {user?.nickname || '未登录'}
          </h2>
          <p className="body-sm text-[var(--text-hint)] truncate">{user?.email || ''}</p>
          {currentBaby && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge size="xs" variant="primary" icon={<Baby className="h-3 w-3" />}>
                {currentBaby.name}
              </Badge>
              {family && (
                <Badge size="xs" variant="sleep">
                  {family.name}
                </Badge>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 快捷入口分组列表（iOS 分组 Cell 风格） */}
      <Card padding="none" className="overflow-hidden">
        {menuItems.map((item, idx) => (
          <button
            key={item.to}
            type="button"
            onClick={() => navigate(item.to)}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-[var(--bg-elevated)]"
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
      </Card>

      {/* 外观（主题 + 字体大小）—— 放在"我的"直接可见可改，避免再跳设置页 */}
      <Card as="section" className="space-y-4">
        <div className="flex items-center gap-2">
          <div
            className="icon-circle icon-circle--sm"
            style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
          >
            <Palette className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="heading-sm" style={{ color: 'var(--text-primary)' }}>
              主题外观
            </h3>
            <p className="caption mt-0.5">深夜照顾宝宝时建议切换为暖夜模式</p>
          </div>
        </div>
        <ThemeSelector />
      </Card>

      <Card as="section" className="space-y-4">
        <div className="flex items-center gap-2">
          <div
            className="icon-circle icon-circle--sm"
            style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
          >
            <Type className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="heading-sm" style={{ color: 'var(--text-primary)' }}>
              字体大小
            </h3>
            <p className="caption mt-0.5">"特大"档位专为老年人 / 低视力场景优化</p>
          </div>
        </div>
        <FontScaleSelector />
      </Card>

      {/* Logout */}
      <Button
        variant="danger-outline"
        block
        onClick={handleLogout}
        loading={isLoggingOut}
        leftIcon={<LogOut className="h-4 w-4" />}
      >
        {isLoggingOut ? '退出中...' : '退出登录'}
      </Button>
    </div>
  )
}
