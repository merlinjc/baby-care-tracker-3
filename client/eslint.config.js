import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      /**
       * react-hooks/set-state-in-effect (React 19 新规则)
       *
       * 该规则禁止在 useEffect 内同步调用 setState，目的是避免级联渲染。
       * 但项目里大量"从异步源（API/localStorage）拉取数据初始化 state"的合理模式
       * （setRecords / setVaccines / setMilestones / setStatus / setBabyStats 等），
       * 这些场景符合 useEffect 设计初衷，重构成 useSyncExternalStore 反而过度。
       * 关闭该规则，保留 react-hooks/exhaustive-deps + rules-of-hooks 等核心校验。
       */
      'react-hooks/set-state-in-effect': 'off',

      /**
       * react-refresh/only-export-components
       *
       * Vite Fast Refresh 只能在"纯组件文件"工作。但项目用 CVA 模式：
       * 同文件 export 组件 + variants 工厂（如 cardVariants）+ 子组件（CardHeader / CardFooter）。
       * 这是 shadcn/ui 的标准做法，所有组件库都这样。
       * 降级为 warning，仅作 IDE 提示，不阻塞 CI。
       */
      'react-refresh/only-export-components': 'warn',
    },
  },
])
