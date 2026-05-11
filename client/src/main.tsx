import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import '@/styles/themes.css'
// i18n 初始化（v7.2 F8）— 必须在 App 渲染之前 import，
// 这样 useTranslation 在首次挂载时就能拿到资源；不要改成 lazy。
import '@/i18n'
import { App } from '@/app/App'
// 提前触发 persist 中间件 hydrate，确保首屏就应用用户选择的字体档位 / 主题
// （避免刷新时先以默认档位渲染再被"校正"导致的视觉闪烁）。
import '@/stores/font-scale-store'
import '@/stores/theme-store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
