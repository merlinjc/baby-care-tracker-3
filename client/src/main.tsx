import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import '@/styles/themes.css'
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
