/**
 * SettingsPage v7 - iOS Settings × 美拉德
 *
 * 重构：
 * - PageHeader → LargeTitleHeader
 * - Tabs → SegmentedControl 顶部切换
 * - 各 form Card：去掉 glass，用 plain
 * - 数据导出：iOS tinted Card 2 卡（JSON brand 暖棕、CSV temperature 蜜桃）
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileJson, FileSpreadsheet, Lock, Save } from 'lucide-react';import { useAuthStore } from '@/stores/auth-store'
import { useBabyStore } from '@/stores/baby-store'
import { authService } from '@/services/auth'
import { exportService } from '@/services/baby-extra'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { toast } from '@/components/ui/toast'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { staggerContainer, staggerItem, pressableSubtle } from '@/lib/motion'

type TabKey = 'profile' | 'password' | 'export'

export function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const loadUser = useAuthStore((s) => s.loadUser)

  const [nickname, setNickname] = useState(user?.nickname || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [searchParams] = useSearchParams()
  const initialTab: TabKey = (() => {
    const t = searchParams.get('tab') as TabKey | null
    return t && ['profile', 'password', 'export'].includes(t) ? t : 'profile'
  })()
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname.trim()) return
    setIsSubmitting(true)
    try {
      await authService.updateProfile({ nickname: nickname.trim() })
      await loadUser()
      toast.success('资料更新成功')
    } catch {
      toast.error('更新失败，请稍后再试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error('新密码至少 8 位')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }
    setIsSubmitting(true)
    try {
      await authService.changePassword({ oldPassword, newPassword })
      toast.success('密码修改成功')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('密码修改失败，请检查旧密码是否正确')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExport = async (format: 'json' | 'csv') => {
    const currentBaby = useBabyStore.getState().currentBaby
    if (!currentBaby) {
      toast.error('请先选择宝宝')
      return
    }
    try {
      const blob = await exportService.exportData({ babyId: currentBaby.id, format })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `baby_care_${currentBaby.name}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} 导出成功`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导出失败')
    }
  }

  return (
    <motion.div
      className="space-y-5"
      data-page-stack
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem}>
        <LargeTitleHeader title="设置" backTo="/profile" />
      </motion.div>

      <motion.div variants={staggerItem}>
        <SegmentedControl
          value={activeTab}
          onChange={(v) => setActiveTab(v as TabKey)}
          options={[
            { value: 'profile', label: '资料' },
            { value: 'password', label: '密码' },
            { value: 'export', label: '导出' },
          ]}
          size="md"
        />
      </motion.div>

      {/* Profile */}
      {activeTab === 'profile' && (
        <motion.div
          key="profile"
          variants={staggerItem}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card as="section" padding="md">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <FormField label="昵称" htmlFor="settings-nickname" required>
                <Input
                  id="settings-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  placeholder="输入昵称"
                />
              </FormField>
              <FormField label="邮箱" htmlFor="settings-email" hint="邮箱不可修改">
                <Input
                  id="settings-email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="opacity-60"
                />
              </FormField>
              <Button
                type="submit"
                variant="filled"
                block
                loading={isSubmitting}
                leftIcon={<Save className="h-4 w-4" />}
              >
                {isSubmitting ? '保存中...' : '保存'}
              </Button>
            </form>
          </Card>
        </motion.div>
      )}

      {/* Password */}
      {activeTab === 'password' && (
        <motion.div
          key="password"
          variants={staggerItem}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card as="section" padding="md">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <FormField label="当前密码" htmlFor="settings-old-pwd" required>
                <Input
                  id="settings-old-pwd"
                  type="password"
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  placeholder="输入当前密码"
                />
              </FormField>
              <FormField label="新密码" htmlFor="settings-new-pwd" required hint="至少 8 位">
                <Input
                  id="settings-new-pwd"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="至少 8 位"
                />
              </FormField>
              <FormField label="确认新密码" htmlFor="settings-confirm-pwd" required>
                <Input
                  id="settings-confirm-pwd"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="再次输入新密码"
                />
              </FormField>
              <Button
                type="submit"
                variant="filled"
                block
                loading={isSubmitting}
                leftIcon={<Lock className="h-4 w-4" />}
              >
                {isSubmitting ? '修改中...' : '修改密码'}
              </Button>
            </form>
          </Card>
        </motion.div>
      )}

      {/* Export */}
      {activeTab === 'export' && (
        <motion.div
          key="export"
          variants={staggerItem}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card as="section" padding="md" className="space-y-4">
            <div>
              <h2 className="headline" style={{ color: 'var(--label)' }}>
                数据导出
              </h2>
              <p
                className="caption-1 mt-1"
                style={{ color: 'var(--label-tertiary)' }}
              >
                导出当前宝宝的护理记录数据
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3" data-grid-2>
              {(
                [
                  {
                    fmt: 'json' as const,
                    Icon: FileJson,
                    label: 'JSON 格式',
                    desc: '完整数据 / 程序友好',
                    bg: 'var(--brand-soft)',
                    fg: 'var(--brand-ink)',
                    accent: 'var(--brand)',
                  },
                  {
                    fmt: 'csv' as const,
                    Icon: FileSpreadsheet,
                    label: 'CSV 格式',
                    desc: '表格 / Excel 可读',
                    bg: 'var(--temperature-bg)',
                    fg: 'var(--temperature-fg)',
                    accent: 'var(--temperature)',
                  },
                ] as const
              ).map(({ fmt, Icon, label, desc, bg, fg, accent }) => (
                <motion.div
                  key={fmt}
                  whileTap={pressableSubtle.whileTap}
                  transition={pressableSubtle.transition}
                >
                  <Card
                    as="article"
                    padding="md"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleExport(fmt)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleExport(fmt)
                      }
                    }}
                    className="flex flex-col items-center text-center gap-2 cursor-pointer h-full"
                    style={{ backgroundColor: bg }}
                  >
                    <div
                      className="w-11 h-11 rounded-[14px] flex items-center justify-center"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${accent} 22%, transparent)`,
                        color: fg,
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="headline" style={{ color: fg }}>
                        {label}
                      </p>
                      <p
                        className="caption-1 mt-0.5"
                        style={{ color: fg, opacity: 0.72 }}
                      >
                        {desc}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
