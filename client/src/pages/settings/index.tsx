import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { User, Lock, Save, Download, FileJson, FileSpreadsheet, Palette } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useBabyStore } from '@/stores/baby-store'
import { authService } from '@/services/auth'
import { exportService } from '@/services/baby-extra'
import { ThemeSelector } from '@/components/theme-selector'
import { PageHeader } from '@/components/page-header'
import { toast } from '@/components/ui/toast'

type TabKey = 'profile' | 'password' | 'appearance' | 'export'

const tabs: { key: TabKey; icon: typeof User; label: string }[] = [
  { key: 'profile', icon: User, label: '资料' },
  { key: 'password', icon: Lock, label: '密码' },
  { key: 'appearance', icon: Palette, label: '外观' },
  { key: 'export', icon: Download, label: '导出' },
]

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
    return t && ['profile', 'password', 'appearance', 'export'].includes(t) ? t : 'profile'
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
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 animate-fade-in-up">
      <PageHeader title="设置" backTo="/profile" />

      {/* Tab Switcher (using tab-button shared class) */}
      <div className="flex gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`tab-button ${activeTab === tab.key ? 'tab-button--active' : ''}`}
              aria-pressed={activeTab === tab.key}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Profile Form */}
      {activeTab === 'profile' && (
        <form onSubmit={handleUpdateProfile} className="card space-y-4 animate-fade-in">
          <div>
            <label className="label-base">昵称</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              placeholder="输入昵称"
              className="input-base"
            />
          </div>
          <div>
            <label className="label-base">邮箱</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="input-base opacity-60"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-hint)' }}
            />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            <Save className="h-4 w-4" />
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </form>
      )}

      {/* Password Form */}
      {activeTab === 'password' && (
        <form onSubmit={handleChangePassword} className="card space-y-4 animate-fade-in">
          <div>
            <label className="label-base">当前密码</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              placeholder="输入当前密码"
              className="input-base"
            />
          </div>
          <div>
            <label className="label-base">新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="至少8位"
              className="input-base"
            />
          </div>
          <div>
            <label className="label-base">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              placeholder="再次输入新密码"
              className="input-base"
            />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            <Lock className="h-4 w-4" />
            {isSubmitting ? '修改中...' : '修改密码'}
          </button>
        </form>
      )}

      {/* Appearance Tab —— FR-G1 三态主题 */}
      {activeTab === 'appearance' && (
        <div className="card space-y-4 animate-fade-in">
          <div>
            <h2 className="heading-sm" style={{ color: 'var(--text-primary)' }}>主题外观</h2>
            <p className="caption mt-1">深夜照顾宝宝时建议切换为暖夜模式以减少屏幕刺激</p>
          </div>
          <ThemeSelector />
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="card space-y-4 animate-fade-in">
          <div>
            <h2 className="heading-sm" style={{ color: 'var(--text-primary)' }}>数据导出</h2>
            <p className="caption mt-1">导出当前宝宝的护理记录数据</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleExport('json')}
              className="card-interactive flex flex-col items-center text-center gap-2 py-5"
            >
              <div
                className="icon-circle icon-circle--md"
                style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
              >
                <FileJson className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="body-md font-medium text-[var(--text-primary)]">JSON 格式</p>
                <p className="caption mt-0.5">完整数据 / 程序友好</p>
              </div>
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="card-interactive flex flex-col items-center text-center gap-2 py-5"
            >
              <div
                className="icon-circle icon-circle--md"
                style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
              >
                <FileSpreadsheet className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="body-md font-medium text-[var(--text-primary)]">CSV 格式</p>
                <p className="caption mt-0.5">表格友好 / Excel 可读</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
