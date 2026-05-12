/**
 * SettingsPage v7 - iOS Settings × 美拉德
 *
 * 重构：
 * - PageHeader → LargeTitleHeader
 * - Tabs → SegmentedControl 顶部切换
 * - 各 form Card：去掉 glass，用 plain
 *
 * v7.2 T-S1-F3：
 * - 移除「数据导出」tab，导出功能迁到独立 `/export` 页（功能更全 + 历史列表）
 * - 旧 `/settings?tab=export` deep link 自动重定向到 `/export`
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Lock, Save } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store'
import { authService } from '@/services/auth'
import { LargeTitleHeader } from '@/components/ui/large-title-header'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { toast } from '@/components/ui/toast'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { LanguageSwitcher } from '@/components/language-switcher'
import { staggerContainer, staggerItem } from '@/lib/motion'

type TabKey = 'profile' | 'password'

export function SettingsPage() {
  const { t } = useTranslation('settings')
  const user = useAuthStore((s) => s.user)
  const loadUser = useAuthStore((s) => s.loadUser)
  const navigate = useNavigate()

  const [nickname, setNickname] = useState(user?.nickname || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [searchParams] = useSearchParams()
  const initialTab: TabKey = (() => {
    const tab = searchParams.get('tab') as string | null
    return tab === 'password' ? 'password' : 'profile'
  })()
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // v7.2 F3：旧 deep link `?tab=export` 重定向到 /export 独立页
  useEffect(() => {
    if (searchParams.get('tab') === 'export') {
      navigate('/export', { replace: true })
    }
    // 仅在挂载时检查一次；后续切换 tab 走 SegmentedControl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          className="space-y-5"
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

          {/* 语言偏好（F8-05 占位，v7.3+ 启用） */}
          <LanguageSwitcher />
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

      {/* Export tab 已迁移到独立 /export 页（v7.2 F3） */}
    </motion.div>
  )
}
