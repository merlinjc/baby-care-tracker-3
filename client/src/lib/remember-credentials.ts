/**
 * 「记住我」相关存储工具
 *
 * ⚠️ 安全约定（与 web-coding-conventions.md §13 对齐）：
 * - 只允许在 localStorage 持久化「用户名/邮箱标识」与「记住我开关」。
 * - **绝不**保存明文密码：明文密码落 localStorage 一旦被 XSS 注入即可被窃取，是严重安全问题。
 * - 浏览器原生密码管理器（autocomplete="current-password" + name="password"）才是密码自动填充的正确方案。
 * - 「保持登录态」依赖：
 *     1) Refresh Token（httpOnly + SameSite=Strict cookie，由后端管理 maxAge）
 *     2) Zustand persist 中的 accessToken（localStorage，刷新页面恢复登录态）
 *     3) axios 拦截器在 access token 过期时自动用 refresh cookie 续期
 */

const KEY_LAST_IDENTIFIER = 'baby_care_last_login_identifier'
const KEY_REMEMBER_ME = 'baby_care_remember_me'

export type LoginIdentifierKind = 'email' | 'phone'

export interface RememberedIdentifier {
  identifier: string
  kind: LoginIdentifierKind
}

/** 读取上次登录的标识（用于自动填充用户名输入框） */
export function readRememberedIdentifier(): RememberedIdentifier | null {
  try {
    const raw = localStorage.getItem(KEY_LAST_IDENTIFIER)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RememberedIdentifier
    if (!parsed.identifier) return null
    return parsed
  } catch {
    return null
  }
}

/** 写入或清除上次登录的标识 */
export function writeRememberedIdentifier(value: RememberedIdentifier | null): void {
  try {
    if (value && value.identifier) {
      localStorage.setItem(KEY_LAST_IDENTIFIER, JSON.stringify(value))
    } else {
      localStorage.removeItem(KEY_LAST_IDENTIFIER)
    }
  } catch {
    // localStorage 配额 / 隐私模式：静默失败
  }
}

/** 读取「记住我」开关值，默认 true（提供更顺滑的默认体验） */
export function readRememberMe(): boolean {
  try {
    const raw = localStorage.getItem(KEY_REMEMBER_ME)
    if (raw === null) return true
    return raw === 'true'
  } catch {
    return true
  }
}

/** 写入「记住我」开关值 */
export function writeRememberMe(value: boolean): void {
  try {
    localStorage.setItem(KEY_REMEMBER_ME, value ? 'true' : 'false')
  } catch {
    // 静默失败
  }
}

/**
 * 简单的「邮箱 vs 手机号」识别。
 * - 含 @ → email
 * - 否则若是 6-15 位数字（兼容国际号 + 国内号）→ phone
 * - 兜底返回 email（让后端 schema 报标准的 INVALID_PARAMS）
 */
export function detectIdentifierKind(input: string): LoginIdentifierKind {
  const trimmed = input.trim()
  if (trimmed.includes('@')) return 'email'
  if (/^\+?\d{6,15}$/.test(trimmed)) return 'phone'
  return 'email'
}
