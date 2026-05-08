/**
 * RegisterPage v7 - iOS Health × 美拉德暖色
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, Mail, User } from 'lucide-react';import { useAuthStore } from '@/stores/auth-store'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { staggerContainer, staggerItem } from '@/lib/motion'

export function RegisterPage() {
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const register = useAuthStore((s) => s.register)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }
    if (password.length < 8) {
      toast.error('密码至少 8 位')
      return
    }

    setIsLoading(true)
    try {
      await register(email, password, nickname)
      navigate('/')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '注册失败，请稍后再试'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  // 密码强度指示（0-3）
  const passwordStrength = (() => {
    if (password.length === 0) return 0
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
    if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++
    return score
  })()
  const strengthColors = [
    'var(--label-quaternary)',
    'var(--danger)',
    'var(--diaper)',
    'var(--feeding)',
  ]
  const strengthLabels = ['', '较弱', '中等', '较强']

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
        创建账号
      </motion.h2>

      <motion.div variants={staggerItem}>
        <FormField label="昵称" htmlFor="register-nickname" required>
          <Input
            id="register-nickname"
            type="text"
            name="nickname"
            autoComplete="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            placeholder="宝宝的爸爸/妈妈"
            leftIcon={<User className="h-4 w-4" />}
          />
        </FormField>
      </motion.div>

      <motion.div variants={staggerItem}>
        <FormField label="邮箱" htmlFor="register-email" required>
          <Input
            id="register-email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="请输入邮箱"
            leftIcon={<Mail className="h-4 w-4" />}
          />
        </FormField>
      </motion.div>

      <motion.div variants={staggerItem}>
        <FormField label="密码" htmlFor="register-password" required hint="至少 8 位，建议包含数字和符号">
          <Input
            id="register-password"
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="至少 8 位密码"
            leftIcon={<Lock className="h-4 w-4" />}
          />
        </FormField>
        {/* 密码强度指示条 */}
        {password.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 flex gap-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex-1 h-1 rounded-full transition-colors"
                  style={{
                    backgroundColor:
                      i <= passwordStrength
                        ? strengthColors[passwordStrength]
                        : 'var(--surface-2)',
                  }}
                />
              ))}
            </div>
            <span
              className="caption-1 shrink-0"
              style={{ color: strengthColors[passwordStrength] }}
            >
              {strengthLabels[passwordStrength]}
            </span>
          </div>
        )}
      </motion.div>

      <motion.div variants={staggerItem}>
        <FormField label="确认密码" htmlFor="register-confirm" required>
          <Input
            id="register-confirm"
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="再次输入密码"
            leftIcon={<Lock className="h-4 w-4" />}
          />
        </FormField>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Button type="submit" variant="filled" loading={isLoading} block size="lg">
          {isLoading ? '注册中...' : '创建账号'}
        </Button>
      </motion.div>

      <motion.p
        variants={staggerItem}
        className="text-center footnote"
        style={{ color: 'var(--label-tertiary)' }}
      >
        已有账号？{' '}
        <Link
          to="/login"
          style={{ color: 'var(--brand-ink)' }}
          className="font-semibold hover:underline"
        >
          登录
        </Link>
      </motion.p>
    </motion.form>
  )
}
