import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { User, Lock, Save, Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useBabyStore } from '@/stores/baby-store'
import { authService } from '@/services/auth'
import { exportService } from '@/services/baby-extra'
import { PageHeader } from '@/components/page-header'
import { toast } from '@/components/ui/toast'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'

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
    // 注意：'appearance' 已于 v5.0.0+ 迁至"我的"页面；老链接兜底回 'profile'
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
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader title="设置" backTo="/profile" />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4" />
            资料
          </TabsTrigger>
          <TabsTrigger value="password">
            <Lock className="h-4 w-4" />
            密码
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="h-4 w-4" />
            导出
          </TabsTrigger>
        </TabsList>

        {/* Profile Form */}
        <TabsContent value="profile">
          <Card as="section" padding="md">
            <form onSubmit={handleUpdateProfile} className="space-y-4 animate-fade-in">
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
                block
                loading={isSubmitting}
                leftIcon={<Save className="h-4 w-4" />}
              >
                {isSubmitting ? '保存中...' : '保存'}
              </Button>
            </form>
          </Card>
        </TabsContent>

        {/* Password Form */}
        <TabsContent value="password">
          <Card as="section" padding="md">
            <form onSubmit={handleChangePassword} className="space-y-4 animate-fade-in">
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
              <FormField
                label="新密码"
                htmlFor="settings-new-pwd"
                required
                hint="至少 8 位"
              >
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
                block
                loading={isSubmitting}
                leftIcon={<Lock className="h-4 w-4" />}
              >
                {isSubmitting ? '修改中...' : '修改密码'}
              </Button>
            </form>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export">
          <Card as="section" padding="md" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="heading-sm" style={{ color: 'var(--text-primary)' }}>
                数据导出
              </h2>
              <p className="caption mt-1">导出当前宝宝的护理记录数据</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card
                as="article"
                variant="interactive"
                padding="md"
                role="button"
                tabIndex={0}
                onClick={() => handleExport('json')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleExport('json')
                  }
                }}
                className="flex flex-col items-center text-center gap-2"
              >
                <div
                  className="icon-circle icon-circle--md"
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, var(--primary) 12%, transparent)',
                  }}
                >
                  <FileJson className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <p className="body-md font-medium text-[var(--text-primary)]">
                    JSON 格式
                  </p>
                  <p className="caption mt-0.5">完整数据 / 程序友好</p>
                </div>
              </Card>
              <Card
                as="article"
                variant="interactive"
                padding="md"
                role="button"
                tabIndex={0}
                onClick={() => handleExport('csv')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleExport('csv')
                  }
                }}
                className="flex flex-col items-center text-center gap-2"
              >
                <div
                  className="icon-circle icon-circle--md"
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, var(--primary) 12%, transparent)',
                  }}
                >
                  <FileSpreadsheet
                    className="h-5 w-5"
                    style={{ color: 'var(--primary)' }}
                  />
                </div>
                <div>
                  <p className="body-md font-medium text-[var(--text-primary)]">
                    CSV 格式
                  </p>
                  <p className="caption mt-0.5">表格友好 / Excel 可读</p>
                </div>
              </Card>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
