/**
 * 微信授权登录 (Web 端) 客户端
 *
 * ⚠️ 当前为「方案预留」实现：
 * - 入口与跳转逻辑已就绪，**默认关闭**（VITE_WECHAT_LOGIN_ENABLED !== 'true' 时不显示按钮）。
 * - 完整启用需要：
 *     1. 在「微信开放平台」(https://open.weixin.qq.com/) 注册「网站应用」，拿到 web 端专用 AppID（与小程序 AppID 不同）。
 *     2. 主体认证（个人开发者目前不支持网站应用）+ 配置 ICP 备案的回调域名。
 *     3. 在前端 .env 配置：
 *          VITE_WECHAT_LOGIN_ENABLED=true
 *          VITE_WECHAT_APP_ID=wxabcdef0123456789       # 网站应用 AppID
 *          VITE_WECHAT_REDIRECT_URI=https://your.domain/auth/wechat/callback
 *     4. 在后端 .env 配置：
 *          WECHAT_WEB_APP_ID=同上
 *          WECHAT_WEB_APP_SECRET=xxxxxxxxxxxx
 *
 * 流程（网页扫码授权 OAuth2）：
 *  ┌──────────┐  1.跳转 open.weixin.qq.com/connect/qrconnect ┌──────────┐
 *  │  Web App │ ─────────────────────────────────────────▶ │  微信平台 │
 *  └──────────┘                                            └──────────┘
 *        ▲                                                       │
 *        │ 4.携 code & state 回到我方 redirect_uri                │
 *        │                                                       │ 2.用户扫码授权
 *        │                                                       ▼
 *  ┌──────────┐  5.前端 POST /api/auth/wechat?code=xxx   ┌──────────┐
 *  │  Web App │ ─────────────────────────────────────▶ │  我方后端 │
 *  └──────────┘                                          └──────────┘
 *                                                              │
 *  ┌──────────┐                                                │ 6.code → access_token + openid + unionid
 *  │ DB user  │ ◀── 8.upsert by wechatUnionId ──────────┐ ─────┘
 *  └──────────┘                                         │
 *  ┌──────────┐  9.发回 我方 JWT + AuthUser            ▼
 *  │  Web App │ ◀────────────────────────────── ┌──────────────┐
 *  └──────────┘                                 │ wechat openapi │
 *                                                └──────────────┘
 *
 * 微信小程序内部场景：另走 `wx.login` + `code2Session`，不在本文件范围（见 miniprogram/）。
 * 公众号 H5 内部场景：用 `snsapi_userinfo` 公众号网页授权 + 不同的开放平台账号。
 */

const WECHAT_OAUTH_AUTHORIZE_URL = 'https://open.weixin.qq.com/connect/qrconnect'
const STATE_STORAGE_KEY = 'baby_care_wechat_oauth_state'

interface WechatLoginConfig {
  enabled: boolean
  appId: string
  redirectUri: string
}

function getConfig(): WechatLoginConfig {
  const enabled = import.meta.env.VITE_WECHAT_LOGIN_ENABLED === 'true'
  const appId = (import.meta.env.VITE_WECHAT_APP_ID ?? '') as string
  const redirectUri = (import.meta.env.VITE_WECHAT_REDIRECT_URI
    ?? `${window.location.origin}/auth/wechat/callback`) as string
  return { enabled, appId, redirectUri }
}

/** 是否启用微信登录入口（控制登录页是否渲染按钮） */
export function isWechatLoginEnabled(): boolean {
  const cfg = getConfig()
  return cfg.enabled && Boolean(cfg.appId) && Boolean(cfg.redirectUri)
}

/** 生成防 CSRF 的 state 值（写入 sessionStorage，回调时校验） */
function generateState(): string {
  const random = (() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as Crypto).randomUUID().replace(/-/g, '')
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
  })()
  try {
    sessionStorage.setItem(STATE_STORAGE_KEY, random)
  } catch {
    // 隐私模式：不阻塞登录，但 callback 阶段无法严格校验
  }
  return random
}

/** 校验回调 state 与发起时是否一致；用于防 CSRF */
export function consumeWechatOauthState(state: string | null): boolean {
  if (!state) return false
  try {
    const expected = sessionStorage.getItem(STATE_STORAGE_KEY)
    sessionStorage.removeItem(STATE_STORAGE_KEY)
    return expected !== null && expected === state
  } catch {
    return false
  }
}

/**
 * 跳转到微信扫码授权页。
 * - 当前为浏览器跳转方式；如需嵌入"扫码二维码"内联容器，需引入微信官方 wxLogin JS SDK，
 *   方案文档详见 docs/web-architecture.md §微信登录扩展。
 */
export function startWechatLogin(): void {
  const cfg = getConfig()
  if (!cfg.enabled) {
    console.warn('[wechat-auth] 当前未启用微信登录；请配置 VITE_WECHAT_LOGIN_ENABLED=true')
    return
  }
  if (!cfg.appId) {
    console.warn('[wechat-auth] 缺少 VITE_WECHAT_APP_ID 环境变量')
    return
  }

  const state = generateState()
  const url = new URL(WECHAT_OAUTH_AUTHORIZE_URL)
  url.searchParams.set('appid', cfg.appId)
  url.searchParams.set('redirect_uri', cfg.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'snsapi_login')
  url.searchParams.set('state', state)
  url.hash = 'wechat_redirect'

  window.location.href = url.toString()
}

/** 后端把回调 code 兑换为我方 JWT 的请求结构（前端调用 /api/auth/wechat） */
export interface WechatLoginRequest {
  code: string
  state?: string
}
