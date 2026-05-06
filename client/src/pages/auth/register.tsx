import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';

export function RegisterPage() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 8) {
      setError('密码至少8位');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, nickname);
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '注册失败，请稍后再试';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="heading-md text-center" style={{ color: 'var(--text-primary)' }}>注册</h2>

      {error && (
        <div className="px-3 py-2 rounded-lg body-sm" style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{error}</div>
      )}

      <div>
        <label className="label-base">昵称</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          placeholder="宝宝的爸爸/妈妈"
          className="input-base"
        />
      </div>

      <div>
        <label className="label-base">邮箱</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="请输入邮箱"
          className="input-base"
        />
      </div>

      <div>
        <label className="label-base">密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="至少8位密码"
          className="input-base"
        />
      </div>

      <div>
        <label className="label-base">确认密码</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="再次输入密码"
          className="input-base"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary w-full"
      >
        {isLoading ? '注册中...' : '注册'}
      </button>

      <p className="text-center body-sm" style={{ color: 'var(--text-hint)' }}>
        已有账号？{' '}
        <Link to="/login" style={{ color: 'var(--primary-dark)' }} className="font-medium hover:underline">
          登录
        </Link>
      </p>
    </form>
  );
}
