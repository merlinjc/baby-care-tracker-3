/**
 * onboarding-steps.ts - Onboarding 4 步定义（v7.2 T-S1-F1-01）
 *
 * 设计要点
 * --------
 * - 步骤静态结构 + 文案 i18n key（业务侧 useTranslation('onboarding') 渲染）
 * - `target` 是一个 DOM 选择器（`[data-onboarding-target="..."]`），Overlay 用
 *   `document.querySelector` 找到目标 → 计算 boundingRect → 绘制裁切高亮
 * - `targetPath` 引导跳转的路由
 * - `isAlreadySatisfied` 接收"上下文环境"返回布尔，用来在已经达成条件的老账号
 *   上自动跳过对应步骤（详见 App.tsx 触发逻辑）
 *
 * 与 i18n 的契约
 * --------------
 * 每一步对应 `onboarding.steps.{id}.title` / `onboarding.steps.{id}.description`，
 * 全部走 t()；本文件不内嵌中文，便于 v7.3+ 加新语言。
 */

export interface OnboardingContext {
  /** 已添加的宝宝数量 */
  babiesCount: number
  /** 当前家庭成员人数（含自己；未加入家庭按 1 算） */
  familyMemberCount: number
  /** 是否已记录过任意一条 record（feeding/sleep/diaper/temperature/growth） */
  hasAnyRecord: boolean
}

export type OnboardingStepId =
  | 'create-baby'
  | 'invite-family'
  | 'first-record'
  | 'try-ai'

export interface OnboardingStep {
  id: OnboardingStepId
  /** i18n key 拼成 `onboarding.steps.{id}.title` 时引用，仅作类型协助 */
  i18nKey: OnboardingStepId
  /**
   * DOM 锚点选择器，例如 `[data-onboarding-target="add-record-fab"]`。
   * 若 Overlay 找不到目标元素，则降级为"无锚点的居中卡"（不影响主流程）。
   */
  target?: string
  /** 完成时跳转的页面路径（点「去试试」时 router.navigate）；不传表示原地不跳转 */
  targetPath?: string
  /** 是否可跳过本步（不可跳过的步骤会隐藏跳过按钮） */
  skippable: boolean
  /** 已满足该步骤的目标条件 → 自动跳过本步（避免对老用户重复引导） */
  isAlreadySatisfied?: (ctx: OnboardingContext) => boolean
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'create-baby',
    i18nKey: 'create-baby',
    targetPath: '/baby',
    skippable: false,
    isAlreadySatisfied: (ctx) => ctx.babiesCount > 0,
  },
  {
    id: 'invite-family',
    i18nKey: 'invite-family',
    targetPath: '/family',
    skippable: true,
    isAlreadySatisfied: (ctx) => ctx.familyMemberCount > 1,
  },
  {
    id: 'first-record',
    i18nKey: 'first-record',
    target: '[data-onboarding-target="add-record-fab"]',
    targetPath: '/record',
    skippable: true,
    isAlreadySatisfied: (ctx) => ctx.hasAnyRecord,
  },
  {
    id: 'try-ai',
    i18nKey: 'try-ai',
    targetPath: '/ai-assistant',
    skippable: true,
  },
]

/**
 * 计算第一个尚未满足的步骤索引；全部满足返回 -1。
 *
 * 业务调用方应根据返回值决定是否触发 Overlay：
 *   - -1 → 直接 PATCH `preferences.onboardingCompleted = true` 不弹 Overlay
 *   - >= 0 → 从该 index 开始进入 Overlay
 *
 * 注意：跳过的步骤不应在此函数中被"已满足"，否则用户主动跳过 invite-family
 * 后下次登录又会被重新弹（违反预期）。我们另外用 `onboardingSkippedSteps`
 * 在 App.tsx 触发处再做一次过滤。
 */
export function findFirstPendingStep(
  ctx: OnboardingContext,
  skipped: ReadonlyArray<string> = [],
): number {
  for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
    const step = ONBOARDING_STEPS[i]
    if (skipped.includes(step.id)) continue
    if (step.isAlreadySatisfied?.(ctx)) continue
    return i
  }
  return -1
}

/** 是否所有步骤都已满足（或被跳过） */
export function allStepsResolved(
  ctx: OnboardingContext,
  skipped: ReadonlyArray<string> = [],
): boolean {
  return findFirstPendingStep(ctx, skipped) === -1
}
