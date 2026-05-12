/**
 * LanguageSwitcher（v7.2 F8-05 占位版）
 *
 * 当前阶段：仅 zh-CN 一种完整资源 → 渲染为 disabled 选择器，
 * 让用户能看到"未来支持英文 / 繁中"的占位入口，避免下一版上线时无处安放。
 *
 * 启用切换的步骤（v7.3+）：
 * 1. 在 `client/src/i18n/index.ts` 的 SUPPORTED_LANGUAGES 数组取消英文/繁中注释，并把对应 NS 资源补全
 * 2. 把 i18n.init({ supportedLngs }) 同步加上 'en-US' / 'zh-TW'
 * 3. 把本组件的 `disabled` 改为 false，并在 onChange 中调用 i18n.changeLanguage(lang) +
 *    `useAuthStore.getState().updatePreferences({ lang, langManuallySet: true })`
 *    （preferences 见 §18 / 共享类型 UserPreferences）
 *
 * 与 INF-01 联动：用户主动切换会同时写本地 localStorage('baby_care_lang') 与
 * 服务端 User.preferences.lang，下次跨设备登录时自动应用偏好。
 */
import { Globe, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n, { SUPPORTED_LANGUAGES } from '@/i18n'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export function LanguageSwitcher() {
  const { t } = useTranslation('settings')
  const currentLang = i18n.resolvedLanguage ?? 'zh-CN'
  const currentMeta = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) ?? SUPPORTED_LANGUAGES[0]

  // v7.2：仅 1 种语言时禁用切换；保持 UI 一致性以便 v7.3+ 直接换 disabled=false
  const disabled = SUPPORTED_LANGUAGES.length <= 1

  return (
    <Card as="section" padding="md" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand-ink)' }}
          >
            <Globe className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="callout font-semibold" style={{ color: 'var(--label)' }}>
              {t('language.title')}
            </h3>
            <p className="caption-1" style={{ color: 'var(--label-tertiary)' }}>
              {t('language.desc')}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                'callout font-medium transition-colors',
                'bg-[var(--surface-2)] hover:bg-[var(--surface-hover)]',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
              style={{ color: 'var(--label)' }}
              title={disabled ? t('language.disabled_hint') : undefined}
            >
              {currentMeta.name}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={6} className="min-w-[140px]">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isCurrent = lang.code === currentLang
              return (
                <DropdownMenuItem key={lang.code} onSelect={() => { /* v7.3+ 启用真正切换 */ }}>
                  <span className="flex-1 text-[14px]" style={{ color: 'var(--label)' }}>
                    {lang.name}
                  </span>
                  {isCurrent && (
                    <Check className="h-4 w-4 shrink-0" style={{ color: 'var(--brand)' }} />
                  )}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {disabled && (
        <p
          className="caption-1 px-1"
          style={{ color: 'var(--label-tertiary)' }}
        >
          {t('language.coming_soon')}
        </p>
      )}
    </Card>
  )
}
