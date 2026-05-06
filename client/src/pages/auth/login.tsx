import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import {
  detectIdentifierKind,
  readRememberMe,
  readRememberedIdentifier,
  writeRememberMe,
  writeRememberedIdentifier,
} from '@/lib/remember-credentials'
import { isWechatLoginEnabled, startWechatLogin } from '@/services/wechat-auth'

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
      <h2 className="heading-md text-center" style={{ color: 'var(--text-primary)' }}>登录</h2>

      {error && (
        <div
          className="px-3 py-2 rounded-lg body-sm"
          style={{
            background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
            color: 'var(--danger)',
          }}
        >
          {error}
        </div>
      )}

      <div>
        <label className="label-base" htmlFor="login-identifier">邮箱 / 手机号</label>
        <input
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
          className="input-base"
        />
      </div>

      <div>
        <label className="label-base" htmlFor="login-password">密码</label>
        <input
          id="login-password"
          type="password"
          name="password"
          // current-password 触发浏览器原生密码管理器自动填充；这是保存密码的"正确"方式
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="请输入密码"
          className="input-base"
        />
      </div>

      <label className="flex items-center gap-2 body-sm cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="h-4 w-4 rounded"
          style={{ accentColor: 'var(--primary)' }}
        />
        <span>记住我（保留账号 7 天，下次自动登录）</span>
      </label>

      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary w-full"
      >
        {isLoading ? '登录中...' : '登录'}
      </button>

      {wechatEnabled && (
        <>
          <div className="flex items-center gap-3 my-2" aria-hidden>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="body-sm" style={{ color: 'var(--text-hint)' }}>或</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <button
            type="button"
            onClick={() => startWechatLogin()}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 body-base transition-opacity hover:opacity-85"
            style={{
              background: '#07C160',
              color: '#FFFFFF',
            }}
          >
            <WechatGlyph />
            微信扫码登录
          </button>
        </>
      )}

      <p className="text-center body-sm" style={{ color: 'var(--text-hint)' }}>
        还没有账号？{' '}
        <Link to="/register" style={{ color: 'var(--primary-dark)' }} className="font-medium hover:underline">
          注册
        </Link>
      </p>
    </form>
  )
}

/** 微信图标（精简内联 SVG，避免单独装 lucide 之外的图标包） */
function WechatGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M9.5 4C5.36 4 2 6.91 2 10.5c0 2.07 1.13 3.91 2.88 5.1L4 18.5l2.79-1.4c.86.27 1.78.4 2.71.4.27 0 .55-.01.81-.03A5.94 5.94 0 0 1 9 14c0-3.31 2.91-6 6.5-6 .35 0 .69.03 1.02.08C15.85 5.79 12.97 4 9.5 4Zm-2.75 4.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm5.5 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
      <path d="M22 14c0-2.76-2.91-5-6.5-5S9 11.24 9 14s2.91 5 6.5 5c.74 0 1.45-.09 2.11-.27L20 19.8l-.6-2.05A4.86 4.86 0 0 0 22 14Zm-9 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm5 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
    </svg>
  )
}
