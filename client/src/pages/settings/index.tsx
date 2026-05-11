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
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { FileJson, FileSpreadsheet, Lock, Save } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store'
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
  const { t } = useTranslation('settings')
  const user = useAuthStore((s) => s.user)
  const loadUser = useAuthStore((s) => s.loadUser)

  const [nickname, setNickname] = useState(user?.nickname || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [searchParams] = useSearchParams()
  const initialTab: TabKey = (() => {
    const tab = searchParams.get('tab') as TabKey | null
    return tab && ['profile', 'password', 'export'].includes(tab) ? tab : 'profile'
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
      toast.success(t('toasts.profile_updated'))
    } catch {
      toast.error(t('toasts.profile_failed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error(t('toasts.password_too_short'))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('toasts.password_mismatch'))
      return
    }
    setIsSubmitting(true)
    try {
      await authService.changePassword({ oldPassword, newPassword })
      toast.success(t('toasts.password_updated'))
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error(t('toasts.password_failed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExport = async (format: 'json' | 'csv') => {
    const currentBaby = useBabyStore.getState().currentBaby
    if (!currentBaby) {
      toast.error(t('toasts.no_baby'))
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
      toast.success(t('toasts.export_success', { format: format.toUpperCase() }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toasts.export_failed'))
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
        <LargeTitleHeader title={t('title')} backTo="/profile" />
      </motion.div>

      <motion.div variants={staggerItem}>
        <SegmentedControl
          value={activeTab}
          onChange={(v) => setActiveTab(v as TabKey)}
          options={[
            { value: 'profile', label: t('tabs.profile') },
            { value: 'password', label: t('tabs.password') },
            { value: 'export', label: t('tabs.export') },
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
              <FormField label={t('profile.nickname')} htmlFor="settings-nickname" required>
                <Input
                  id="settings-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  placeholder={t('profile.nickname_placeholder')}
                />
              </FormField>
              <FormField label={t('profile.email')} htmlFor="settings-email" hint={t('profile.email_hint')}>
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
                {isSubmitting ? t('profile.saving') : t('profile.save')}
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
              <FormField label={t('password.old')} htmlFor="settings-old-pwd" required>
                <Input
                  id="settings-old-pwd"
                  type="password"
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  placeholder={t('password.old_placeholder')}
                />
              </FormField>
              <FormField label={t('password.new')} htmlFor="settings-new-pwd" required hint={t('password.new_hint')}>
                <Input
                  id="settings-new-pwd"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder={t('password.new_placeholder')}
                />
              </FormField>
              <FormField label={t('password.confirm')} htmlFor="settings-confirm-pwd" required>
                <Input
                  id="settings-confirm-pwd"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder={t('password.confirm_placeholder')}
                />
              </FormField>
              <Button
                type="submit"
                variant="filled"
                block
                loading={isSubmitting}
                leftIcon={<Lock className="h-4 w-4" />}
              >
                {isSubmitting ? t('password.submitting') : t('password.submit')}
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
                {t('export.title')}
              </h2>
              <p
                className="caption-1 mt-1"
                style={{ color: 'var(--label-tertiary)' }}
              >
                {t('export.desc')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3" data-grid-2>
              {(
                [
                  {
                    fmt: 'json' as const,
                    Icon: FileJson,
                    label: t('export.json_label'),
                    desc: t('export.json_desc'),
                    bg: 'var(--brand-soft)',
                    fg: 'var(--brand-ink)',
                    accent: 'var(--brand)',
                  },
                  {
                    fmt: 'csv' as const,
                    Icon: FileSpreadsheet,
                    label: t('export.csv_label'),
                    desc: t('export.csv_desc'),
                    bg: 'var(--temperature-bg)',
                    fg: 'var(--temperature-fg)',
                    accent: 'var(--temperature)',
                  },
                ]
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
