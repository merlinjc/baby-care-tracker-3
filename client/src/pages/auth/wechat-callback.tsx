import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { authApi } from '@/services/auth'
import { consumeWechatOauthState } from '@/services/wechat-auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * 微信扫码登录回调页：/auth/wechat/callback?code=xxx&state=xxx
 *
 * 后端必须实现 POST /api/auth/wechat（详见 server/src/routes/auth.ts wechat 分支与 docs/web-api-spec.md §2.7）。
 * 当前为方案预留页：默认配置未启用时仍能渲染状态文案，避免线上点错链接出现白屏。
 */
export function WechatCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const setToken = useAuthStore((s) => s.setToken)
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const onceRef = useRef(false)

  useEffect(() => {
    if (onceRef.current) return
    onceRef.current = true

    const code = params.get('code')
    const state = params.get('state')

    if (!code) {
      setStatus('error')
      setErrorMsg('未收到微信授权 code')
      return
    }
    if (!consumeWechatOauthState(state)) {
      setStatus('error')
      setErrorMsg('授权状态校验失败，请重新登录')
      return
    }

    void (async () => {
      try {
        const data = await authApi.loginWithWechat({ code, state: state ?? undefined })
        // 与普通登录保持一致：写入 store + 跳首页
        setToken(data.accessToken)
        useAuthStore.setState({ user: data.user, isAuthenticated: true })
        navigate('/', { replace: true })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '微信登录失败，请稍后再试'
        setErrorMsg(message)
        setStatus('error')
      }
    })()
  }, [params, navigate, setToken])

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-primary)' }}>
      <Card padding="md" className="max-w-sm w-full text-center space-y-3">
        {status === 'loading' ? (
          <>
            <div className="spinner mx-auto" />
            <p className="body-base" style={{ color: 'var(--text-primary)' }}>正在完成微信登录…</p>
          </>
        ) : (
          <>
            <p className="heading-sm" style={{ color: 'var(--danger)' }}>登录失败</p>
            <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{errorMsg}</p>
            <Button block onClick={() => navigate('/login', { replace: true })}>
              返回登录
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}
