import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

/**
 * Vite 配置（v7.2 F9 路由级代码分割增强）
 *
 * 关键改造：
 * 1. manualChunks 将 vendor 拆分为 react / query / radix / motion / icons / utils 6 组，
 *    避免业务 chunk 反复打入相同的 React / Radix 代码。
 * 2. 仅在 ANALYZE=true 时启用 rollup-plugin-visualizer，输出 dist/stats.html。
 *    生产构建（默认 `vite build`）不引入该插件，保持构建产物精简。
 */
const isAnalyze = process.env.ANALYZE === 'true'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(isAnalyze
      ? [
          visualizer({
            filename: 'dist/stats.html',
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
            open: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@baby-care-tracker/shared': path.resolve(__dirname, '../shared/types'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8 / Rolldown 仅接受函数形式的 manualChunks。
        // 这里按"内聚度 / 体积"将三方依赖切成多个 vendor chunk，
        // 业务 chunk 不再重复打入这些代码，长缓存命中率显著提升。
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          // React 核心 + Router
          if (
            /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(
              id,
            )
          ) {
            return 'vendor-react'
          }

          // React Query
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query'
          }

          // Radix UI 全家桶
          if (id.includes('@radix-ui/')) {
            return 'vendor-radix'
          }

          // 动画
          if (id.includes('framer-motion')) {
            return 'vendor-motion'
          }

          // 图标
          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }

          // i18n
          if (
            /[\\/]node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/.test(
              id,
            )
          ) {
            return 'vendor-i18n'
          }

          // 通用工具
          if (
            /[\\/]node_modules[\\/](axios|clsx|tailwind-merge|class-variance-authority|zustand)[\\/]/.test(
              id,
            )
          ) {
            return 'vendor-utils'
          }

          return undefined
        },
      },
    },
    // 单 chunk 超过该阈值（KB）时打 warning。
    // v7.2 拆分后单业务 chunk 远低于此值，保留 600 作为新基线告警阈值
    chunkSizeWarningLimit: 600,
  },
})
