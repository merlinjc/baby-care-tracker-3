/**
 * RegisterPage - 用户注册页
 *
 * Batch 1 改造要点：
 * - <input className="input-base"> → <Input leftIcon> + <FormField>
 * - <button className="btn-primary"> → <Button block>
 * - required=true 自动加红色 *
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, User } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
      <h2 className="heading-md text-center" style={{ color: 'var(--text-primary)' }}>
        注册
      </h2>

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

      <FormField label="密码" htmlFor="register-password" required hint="至少 8 位">
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

      <Button type="submit" loading={isLoading} block size="md">
        {isLoading ? '注册中...' : '注册'}
      </Button>

      <p className="text-center text-sm" style={{ color: 'var(--text-hint)' }}>
        已有账号？{' '}
        <Link
          to="/login"
          style={{ color: 'var(--primary-dark)' }}
          className="font-medium hover:underline"
        >
          登录
        </Link>
      </p>
    </form>
  )
}
