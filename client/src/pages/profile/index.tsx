/**
 * ProfilePage v7.1 - iOS Settings × 美拉德暖色（视觉层次重梳理）
 *
 * 节奏（组内紧凑 / 组间 break）：
 *   - 大标题 → Hero 卡：24px
 *   - Hero 卡 → 「账户与数据」组标题：32px
 *   - 组标题 → 该组卡片：6px
 *   - 「账户与数据」组 → 「外观」组标题：32px
 *   - 「外观」组内 主题卡 → 字体卡：16px
 *   - 字体卡 → 退出登录：40px（destructive break）
 *
 * 所有节奏由 globals.css 的 [data-profile-*] 选择器集中管理，
 * 该组件只负责给每个 stack 子项打上正确的 data 标签。
 */
import { useState } from 'react'
import { Download, LogOut, Palette, Settings, Type, User, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth-store'
import { useBabyStore } from '@/stores/baby-store'
import { useFamilyStore } from '@/stores/family-store'
import { authService } from '@/services/auth'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SectionHeader } from '@/components/ui/section-header'
import { ListRow } from '@/components/ui/list-row'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { ThemeSelector } from '@/components/theme-selector'
import { FontScaleSelector } from '@/components/font-scale-selector'
import { staggerContainer, staggerItem } from '@/lib/motion'

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

  const menuItems = [
    {
      to: '/baby',
      icon: User,
      label: '宝宝管理',
      detail: babies.length > 0 ? `${babies.length} 位` : '未添加',
      color: 'var(--brand)',
    },
    {
      to: '/family',
      icon: UserCircle,
      label: '家庭管理',
      detail: family?.name ?? '未加入',
      color: 'var(--sleep)',
    },
    {
      to: '/settings?tab=export',
      icon: Download,
      label: '数据导出',
      detail: undefined,
      color: 'var(--temperature)',
    },
    {
      to: '/settings',
      icon: Settings,
      label: '设置',
      detail: undefined,
      color: 'var(--label-tertiary)',
    },
  ]

  return (
    <motion.div
      data-page-stack
      data-profile-stack
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* —— 1. Large Title —— */}
      <motion.div variants={staggerItem} data-profile-row="title">
        <LargeTitleHeader title="我的" />
      </motion.div>

      {/* —— 2. Hero 用户卡 —— */}
      <motion.div variants={staggerItem} data-profile-row="hero">
        <Card
          variant="hero"
          padding="lg"
          className="flex items-center gap-5"
          style={{ backgroundColor: 'var(--brand-soft)' }}
        >
          <UserAvatar user={{ nickname: user?.nickname, avatar: null }} size="xl" />
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <h2 className="title-3 truncate" style={{ color: 'var(--brand-ink)' }}>
              {user?.nickname || '未登录'}
            </h2>
            {user?.email && (
              <p
                className="footnote truncate"
                style={{ color: 'var(--label-secondary)' }}
              >
                {user.email}
              </p>
            )}
            {(currentBaby || family) && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {currentBaby && (
                  <Badge size="xs" variant="brand" icon={<User className="h-3 w-3" />}>
                    {currentBaby.name}
                  </Badge>
                )}
                {family && (
                  <Badge size="xs" variant="sleep">
                    {family.name}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* —— 3. 「账户与数据」分组标题 —— */}
      <motion.div variants={staggerItem} data-profile-row="group-header">
        <SectionHeader title="账户与数据" variant="grouped" />
      </motion.div>

      {/* —— 4. 「账户与数据」列表卡 —— */}
      <motion.div variants={staggerItem} data-profile-row="group-content">
        <Card variant="elevated" padding="none">
          <div className="ios-list">
            {menuItems.map((item) => (
              <ListRow
                key={item.to}
                padding="none"
                className="px-5 py-3.5"
                leading={
                  <div
                    className="w-9 h-9 shrink-0 rounded-[9px] flex items-center justify-center"
                    style={{
                      // 暗色主题下 18% 对比度偏弱，提到 22%；亮色主题下差别可忽略
                      backgroundColor: `color-mix(in srgb, ${item.color} 22%, transparent)`,
                    }}
                  >
                    <item.icon
                      className="shrink-0"
                      style={{ color: item.color, width: 18, height: 18 }}
                    />
                  </div>
                }
                title={item.label}
                value={item.detail}
                interactive
                onClick={() => navigate(item.to)}
              />
            ))}
          </div>
        </Card>
      </motion.div>

      {/* —— 5. 「外观」分组标题 —— */}
      <motion.div variants={staggerItem} data-profile-row="group-header">
        <SectionHeader title="外观" variant="grouped" />
      </motion.div>

      {/* —— 6. 主题模式卡 —— */}
      <motion.div variants={staggerItem} data-profile-row="group-content">
        <Card as="section" padding="lg">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--brand-soft)' }}
            >
              <Palette className="h-[18px] w-[18px]" style={{ color: 'var(--brand)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="font-semibold"
                style={{
                  color: 'var(--label)',
                  fontSize: 'var(--text-headline)',
                  lineHeight: 1.45,
                }}
              >
                主题模式
              </h3>
              <p
                className="mt-1"
                style={{
                  color: 'var(--label-tertiary)',
                  fontSize: 'var(--text-caption-1)',
                  lineHeight: 1.5,
                }}
              >
                深夜照顾宝宝时建议切换为暖夜模式
              </p>
            </div>
          </div>
          <ThemeSelector />
        </Card>
      </motion.div>

      {/* —— 7. 字体大小卡 —— */}
      <motion.div variants={staggerItem} data-profile-row="group-content">
        <Card as="section" padding="lg">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--brand-soft)' }}
            >
              <Type className="h-[18px] w-[18px]" style={{ color: 'var(--brand)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="font-semibold"
                style={{
                  color: 'var(--label)',
                  fontSize: 'var(--text-headline)',
                  lineHeight: 1.45,
                }}
              >
                字体大小
              </h3>
              <p
                className="mt-1"
                style={{
                  color: 'var(--label-tertiary)',
                  fontSize: 'var(--text-caption-1)',
                  lineHeight: 1.5,
                }}
              >
                "特大"档位专为老年人 / 低视力场景优化
              </p>
            </div>
          </div>
          <FontScaleSelector />
        </Card>
      </motion.div>

      {/* —— 8. 退出登录 —— */}
      <motion.div variants={staggerItem} data-profile-logout>
        <Button
          variant="destructive-plain"
          block
          size="lg"
          onClick={handleLogout}
          loading={isLoggingOut}
          leftIcon={<LogOut className="h-4 w-4" />}
        >
          {isLoggingOut ? '退出中...' : '退出登录'}
        </Button>
      </motion.div>
    </motion.div>
  )
}
