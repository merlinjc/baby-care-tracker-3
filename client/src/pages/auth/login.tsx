/**
 * LoginPage v7 - iOS Health × 美拉德暖色
 *
 * 改造：
 * - heading-md → title-2（SF Pro Display 字阶）
 * - 错误横条：改用 --danger-bg / --danger-fg（暖玫红而非 iOS systemRed）
 * - Button 升级到 v7：filled（主）/ secondary（微信，保留 06C160 自定义色）
 * - 不改业务逻辑
 */
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, Mail } from 'lucide-react';import { useAuthStore } from '@/stores/auth-store'
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
import { staggerContainer, staggerItem } from '@/lib/motion'

export function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

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
      await login(
        kind === 'email'
          ? { email: trimmed, password }
          : { phone: trimmed, password },
      )

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
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-5"
      autoComplete="on"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.h2
        variants={staggerItem}
        className="title-2 text-center"
        style={{ color: 'var(--label)' }}
      >
        欢迎回来
      </motion.h2>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-3.5 py-2.5 rounded-[var(--radius-md)] footnote"
          style={{
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger-fg)',
          }}
          role="alert"
        >
          {error}
        </motion.div>
      )}

      <motion.div variants={staggerItem}>
        <FormField label="邮箱 / 手机号" htmlFor="login-identifier">
          <Input
            id="login-identifier"
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
      </motion.div>

      <motion.div variants={staggerItem}>
        <FormField label="密码" htmlFor="login-password">
          <Input
            id="login-password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="请输入密码"
            leftIcon={<Lock className="h-4 w-4" />}
          />
        </FormField>
      </motion.div>

      <motion.label
        variants={staggerItem}
        className="flex items-center gap-2.5 footnote cursor-pointer select-none"
        style={{ color: 'var(--label-secondary)' }}
      >
        <Switch
          size="sm"
          checked={rememberMe}
          onCheckedChange={setRememberMe}
          aria-label="记住我"
        />
        <span>记住我（保留账号 7 天，下次自动登录）</span>
      </motion.label>

      <motion.div variants={staggerItem}>
        <Button type="submit" variant="filled" loading={isLoading} block size="lg">
          {isLoading ? '登录中...' : '登录'}
        </Button>
      </motion.div>

      {wechatEnabled && (
        <motion.div variants={staggerItem} className="space-y-4">
          <Separator label="或" />
          <Button
            type="button"
            onClick={() => startWechatLogin()}
            block
            size="lg"
            leftIcon={<WechatGlyph />}
            className="!text-white"
            style={{ backgroundColor: '#07C160' }}
          >
            微信扫码登录
          </Button>
        </motion.div>
      )}

      <motion.p
        variants={staggerItem}
        className="text-center footnote"
        style={{ color: 'var(--label-tertiary)' }}
      >
        还没有账号？{' '}
        <Link
          to="/register"
          style={{ color: 'var(--brand-ink)' }}
          className="font-semibold hover:underline"
        >
          注册
        </Link>
      </motion.p>
    </motion.form>
  )
}

function WechatGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9.5 4C5.36 4 2 6.91 2 10.5c0 2.07 1.13 3.91 2.88 5.1L4 18.5l2.79-1.4c.86.27 1.78.4 2.71.4.27 0 .55-.01.81-.03A5.94 5.94 0 0 1 9 14c0-3.31 2.91-6 6.5-6 .35 0 .69.03 1.02.08C15.85 5.79 12.97 4 9.5 4Zm-2.75 4.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm5.5 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
      <path d="M22 14c0-2.76-2.91-5-6.5-5S9 11.24 9 14s2.91 5 6.5 5c.74 0 1.45-.09 2.11-.27L20 19.8l-.6-2.05A4.86 4.86 0 0 0 22 14Zm-9 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm5 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
    </svg>
  )
}
