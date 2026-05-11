/**
 * i18n 初始化（v7.2 F8 i18n 框架预埋）
 *
 * 设计要点：
 * - 仅 zh-CN 完整资源；fallbackLng = zh-CN，保证未抽离的页面也能正常显示
 * - 检测顺序：localStorage(baby_care_lang) > navigator；用户主动切换后写回 localStorage
 * - 资源同步打入主入口（5 个高频页面 + 公共 NS），bundle 影响 <50KB gzip 可接受
 * - 未来跨设备语言：上线英文 / 繁中后通过 `User.preferences.lang` 读取并 `i18n.changeLanguage()`
 *
 * 接入方式（业务层）：
 *   const { t } = useTranslation('home')
 *   <h1>{t('hero.title')}</h1>
 *
 * 添加新语言（v7.3+）：
 *   1. 在 resources/{locale}/ 下复制同名 JSON
 *   2. 在 RESOURCES 常量中加入引用
 *   3. （可选）启用 LanguageSwitcher 组件
 *
 * 添加新命名空间：
 *   1. 在 resources/zh-CN/ 下新建 {ns}.json
 *   2. 在 RESOURCES 常量加入引用
 *   3. 业务层 useTranslation('{ns}')
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// zh-CN 资源（同步导入，确保首屏即可用，不需 Suspense）
import zhCommon from './resources/zh-CN/common.json'
import zhNav from './resources/zh-CN/nav.json'
import zhHome from './resources/zh-CN/home.json'
import zhRecord from './resources/zh-CN/record.json'
import zhReport from './resources/zh-CN/report.json'
import zhAi from './resources/zh-CN/ai.json'
import zhSettings from './resources/zh-CN/settings.json'
import zhExport from './resources/zh-CN/export.json'

/**
 * 资源注册表 — 后续新增命名空间 / 语言时统一在这里维护。
 *
 * 注意：所有键均为 string。useTranslation('xxx') 时第二个参数 ns 必须在此声明，
 * 否则会回落到 defaultNS=common，可能拿不到对应文案。
 */
const RESOURCES = {
  'zh-CN': {
    common: zhCommon,
    nav: zhNav,
    home: zhHome,
    record: zhRecord,
    report: zhReport,
    ai: zhAi,
    settings: zhSettings,
    export: zhExport,
  },
} as const

/** 已注册的命名空间列表，TypeScript 类型推导用 */
export const NAMESPACES = ['common', 'nav', 'home', 'record', 'report', 'ai', 'settings', 'export'] as const
export type Namespace = (typeof NAMESPACES)[number]

/** 已支持的语言列表，未来切换器从此读取 */
export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  // v7.3+ 启用：
  // { code: 'en-US', name: 'English' },
  // { code: 'zh-TW', name: '繁體中文' },
] as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: RESOURCES,
    // 仅 zh-CN 完整；任何未识别 locale 都回落到 zh-CN
    fallbackLng: 'zh-CN',
    // 仅允许已注册的语言；其他直接走 fallback
    supportedLngs: ['zh-CN'],
    defaultNS: 'common',
    ns: [...NAMESPACES],
    interpolation: {
      // React 已自带 XSS 防护
      escapeValue: false,
    },
    detection: {
      // 优先 localStorage，便于后续 LanguageSwitcher 直接写回
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      // key 与现有 baby_care_* 命名约定一致
      lookupLocalStorage: 'baby_care_lang',
    },
    react: {
      // 不使用 Suspense，避免 lazy 路由 Fallback 与 i18n hydration 冲突
      useSuspense: false,
    },
    // 开发态打印缺失 key，便于发现遗漏
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (lngs, ns, key) => {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] missing key: [${lngs?.join(',')}] ${ns}:${key}`)
        }
      : undefined,
  })

export default i18n
