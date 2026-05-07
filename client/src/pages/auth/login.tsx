/**
 * LoginPage - 用户登录页
 *
 * Batch 1 改造要点：
 * - 裸 <input className="input-base"> → <Input leftIcon> + <FormField>
 * - 手写错误横条 → <Alert variant="danger">（暂缓到 Batch 2 引入 Alert 时替换；
 *   本期保留原 div 错误条，但结构复用 var(--danger) 色阶）
 * - 复选框 → 暂保留原生 input（Switch 在 Batch 2 引入）
 * - 主/微信按钮 → <Button>
 * - 或分隔 → <Separator label="或">
 */
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  detectIdentifierKind,
  readRememberMe,
  readRememberedIdentifier,
  writeRememberMe,
  writeRememberedIdentifier,
} from '@/lib/remember-credentials'
import { isWechatLoginEnabled, startWechatLogin } from '@/services/wechat-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

export function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  // 进入页面时回填：上次登录的标识 + 「记住我」开关
  useEffect(() => {
    const remembered = readRememberedIdentifier()
    if (remembered) setIdentifier(remembered.identifier)
    setRememberMe(readRememberMe())
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const trimmed = identifier.trim()
      const kind = detectIdentifierKind(trimmed)
      // 根据用户输入自动判定走 email 还是 phone 字段
      await login(
        kind === 'email'
          ? { email: trimmed, password }
          : { phone: trimmed, password },
      )

      // 登录成功后按「记住我」决定是否记忆用户名
      writeRememberMe(rememberMe)
      writeRememberedIdentifier(rememberMe ? { identifier: trimmed, kind } : null)

      navigate('/')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '登录失败，请检查账号和密码'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const wechatEnabled = isWechatLoginEnabled()

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
      <h2 className="heading-md text-center" style={{ color: 'var(--text-primary)' }}>
        登录
      </h2>

      {error && (
        <div
          className="px-3 py-2 rounded-lg text-sm leading-snug"
          style={{
            background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
            color: 'var(--danger)',
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      <FormField label="邮箱 / 手机号" htmlFor="login-identifier">
        <Input
          id="login-identifier"
          // 用 text 而非 email：支持手机号；浏览器密码管理器仍会按 username 字段记忆
          type="text"
          inputMode="email"
          name="username"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          placeholder="请输入邮箱或手机号"
          leftIcon={<Mail className="h-4 w-4" />}
        />
      </FormField>

      <FormField label="密码" htmlFor="login-password">
        <Input
          id="login-password"
          type="password"
          name="password"
          // current-password 触发浏览器原生密码管理器自动填充；这是保存密码的"正确"方式
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="请输入密码"
          leftIcon={<Lock className="h-4 w-4" />}
        />
      </FormField>

      <label
        className="flex items-center gap-2.5 text-sm cursor-pointer select-none"
        style={{ color: 'var(--text-secondary)' }}
      >
        <Switch
          size="sm"
          checked={rememberMe}
          onCheckedChange={setRememberMe}
          aria-label="记住我"
        />
        <span>记住我（保留账号 7 天，下次自动登录）</span>
      </label>

      <Button type="submit" loading={isLoading} block size="md">
        {isLoading ? '登录中...' : '登录'}
      </Button>

      {wechatEnabled && (
        <>
          <Separator label="或" />

          <Button
            type="button"
            onClick={() => startWechatLogin()}
            block
            size="md"
            accentColor="#07C160"
            leftIcon={<WechatGlyph />}
            className="!text-white"
            style={{ backgroundColor: '#07C160' }}
          >
            微信扫码登录
          </Button>
        </>
      )}

      <p className="text-center text-sm" style={{ color: 'var(--text-hint)' }}>
        还没有账号？{' '}
        <Link
          to="/register"
          style={{ color: 'var(--primary-dark)' }}
          className="font-medium hover:underline"
        >
          注册
        </Link>
      </p>
    </form>
  )
}

/** 微信图标（精简内联 SVG，避免单独装 lucide 之外的图标包） */
function WechatGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9.5 4C5.36 4 2 6.91 2 10.5c0 2.07 1.13 3.91 2.88 5.1L4 18.5l2.79-1.4c.86.27 1.78.4 2.71.4.27 0 .55-.01.81-.03A5.94 5.94 0 0 1 9 14c0-3.31 2.91-6 6.5-6 .35 0 .69.03 1.02.08C15.85 5.79 12.97 4 9.5 4Zm-2.75 4.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm5.5 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
      <path d="M22 14c0-2.76-2.91-5-6.5-5S9 11.24 9 14s2.91 5 6.5 5c.74 0 1.45-.09 2.11-.27L20 19.8l-.6-2.05A4.86 4.86 0 0 0 22 14Zm-9 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm5 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
    </svg>
  )
}
