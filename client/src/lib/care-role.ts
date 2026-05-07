/**
 * care-role.ts - 育儿角色（CareRole）的前端辅助
 *
 * - 负责把 `FamilyMember.relation` 字符串（在创建 / 加入家庭时由用户通过
 *   `<CareRoleSelector>` 选定，取值为 CareRole 枚举；也兼容历史自由文本昵称
 *   如 '妈妈' / '奶奶'）映射到严格的 CareRole 枚举
 * - 提供 CareRole -> 中文标签 / emoji 的 UI 映射
 *
 * v5.0.0+：身份完全由 `FamilyMember.relation` 决定（创建 / 加入家庭时必选），
 * 首页不再提供"手动切换视角"的 localStorage 覆盖机制。
 */
import type { CareRole } from '@baby-care-tracker/shared'

export const CARE_ROLE_OPTIONS: Array<{
  value: CareRole
  label: string
  emoji: string
  /** 简短描述，用于下拉选项 */
  desc: string
}> = [
  { value: 'mom', label: '妈妈', emoji: '👩', desc: '侧重母乳喂养 / 产后自我照护' },
  { value: 'dad', label: '爸爸', emoji: '👨', desc: '侧重分担育儿 / 情感支持' },
  { value: 'grandma_m', label: '外婆', emoji: '👵', desc: '祖辈视角，科学育儿提示' },
  { value: 'grandma_p', label: '奶奶', emoji: '👵', desc: '祖辈视角，科学育儿提示' },
  { value: 'grandpa_m', label: '外公', emoji: '👴', desc: '祖辈视角，动手育儿建议' },
  { value: 'grandpa_p', label: '爷爷', emoji: '👴', desc: '祖辈视角，动手育儿建议' },
  { value: 'nanny', label: '月嫂 / 育儿嫂', emoji: '👩‍⚕️', desc: '专业护理 + 交接要点' },
  { value: 'other', label: '其他', emoji: '🙂', desc: '中立顾问视角' },
]

/** 取某个 CareRole 的 UI 元信息；未命中返回 other 的元信息 */
export function getCareRoleMeta(role?: CareRole | null) {
  const hit = CARE_ROLE_OPTIONS.find((o) => o.value === role)
  return hit ?? CARE_ROLE_OPTIONS[CARE_ROLE_OPTIONS.length - 1]
}

/**
 * 把 `FamilyMember.relation` 或其他任意字符串映射到 CareRole。
 * 兼容英文 key / 中文称谓 / 空值。
 *
 * 精确命中逻辑：
 * 1. relation 等于 CareRole 枚举值（'mom'/'dad'/...）→ 直接返回
 * 2. 中文关键字包含匹配 → 返回对应 CareRole（老数据兼容）
 * 3. 有值但都未命中 → 'other'
 * 4. 空值 → null
 */
export function relationToCareRole(
  relation?: string | null,
  relationText?: string | null,
): CareRole | null {
  const raw = (relation ?? relationText ?? '').trim().toLowerCase()
  if (!raw) return null
  // 优先：精确命中 CareRole 枚举（创建/加入家庭时用户主动选择的结果）
  const exact = CARE_ROLE_OPTIONS.find((o) => o.value === raw)
  if (exact) return exact.value
  // 降级：中文关键字包含匹配（v5.0.0 之前的自由文本昵称兼容）
  if (raw.includes('妈')) return 'mom'
  if (raw.includes('爸')) return 'dad'
  if (raw.includes('外婆') || raw.includes('姥姥')) return 'grandma_m'
  if (raw.includes('奶奶')) return 'grandma_p'
  if (raw.includes('外公') || raw.includes('姥爷')) return 'grandpa_m'
  if (raw.includes('爷爷')) return 'grandpa_p'
  if (raw.includes('月嫂') || raw.includes('育儿嫂') || raw.includes('保姆')) return 'nanny'
  return 'other'
}

/**
 * 清理旧版"手动切换视角"残留的 localStorage 键。
 * v5.0.0+ 身份改由 `FamilyMember.relation` 单一数据源决定；
 * App 启动时调用一次，避免旧键继续生效。
 */
export function cleanupLegacyPreferredCareRole(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem('baby_care_preferred_care_role')
  } catch {
    // 忽略 localStorage 访问异常（如隐私模式）
  }
}
