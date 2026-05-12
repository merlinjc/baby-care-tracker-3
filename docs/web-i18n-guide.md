# Web 端 i18n 使用指南

> 版本：v7.2（2026-05-11，F8 引入）
> 框架：`react-i18next` + `i18next` + `i18next-browser-languagedetector`
> 模块：`client/src/i18n/`
> 本文档聚焦"**跨 team 通用接入流程**"；业务侧详细规范另见 `docs/web-coding-conventions.md §20`。

---

## 1. 当前支持度

| 语言 | 代码 | 完整度 | 启用版本 |
|---|---|---|---|
| 简体中文 | `zh-CN` | ✅ 完整 | v7.2 |
| English | `en-US` | ⬜ 预留 | v7.3+ |
| 繁体中文 | `zh-TW` | ⬜ 预留 | v7.3+ |

**检测顺序**：`localStorage('baby_care_lang')` → `navigator.language`，命中失败回落 `zh-CN`。

**跨设备同步**：用户主动切换语言会写 `User.preferences.lang`（v7.2 T-S1-INF-01 字段）；下次另一台设备登录时自动应用。

---

## 2. 快速接入

### 业务组件里调用

```tsx
import { useTranslation } from 'react-i18next'

export function MyComponent() {
  const { t } = useTranslation('home')   // 命名空间 = home
  return <h1>{t('hero.title')}</h1>
}
```

### 添加新文案 Key

直接编辑 `client/src/i18n/resources/zh-CN/{ns}.json`：

```diff
 {
   "hero": {
-    "title": "你好"
+    "title": "你好",
+    "subtitle": "记录温柔的日常"
   }
 }
```

### 新增命名空间

1. 新建 `resources/zh-CN/{ns}.json`
2. 在 `client/src/i18n/index.ts`：
   ```ts
   import zhMyNs from './resources/zh-CN/my-ns.json'

   const RESOURCES = { 'zh-CN': { ...其他, 'my-ns': zhMyNs } }
   export const NAMESPACES = [...其他, 'my-ns'] as const
   ```
3. 业务层：`useTranslation('my-ns')`

### 新增语言（v7.3+）

1. 复制 `resources/zh-CN/` 整个目录为 `resources/{locale}/`，翻译所有 ns
2. 在 `client/src/i18n/index.ts`：
   ```ts
   import zhCommon from './resources/zh-CN/common.json'
   import enCommon from './resources/en-US/common.json'
   // ...同样方式 import 其他 ns

   const RESOURCES = {
     'zh-CN': { common: zhCommon, ... },
     'en-US': { common: enCommon, ... },
   }
   ```
3. 同步更新 `supportedLngs` 数组与 `SUPPORTED_LANGUAGES` 元数据
4. 修改 `LanguageSwitcher` 的 `disabled` 判断（基于 `SUPPORTED_LANGUAGES.length > 1` 即可自动启用）
5. 在 onChange 中真正调用 `i18n.changeLanguage(lang)` + `useAuthStore.getState().updatePreferences({ lang, langManuallySet: true })`

---

## 3. 占位符与复数

### 占位符

```json
// resources/zh-CN/common.json
{ "time": { "minutes_ago": "{{count}} 分钟前" } }
```

```tsx
t('time.minutes_ago', { count: 5 })   // → "5 分钟前"
```

### 复数（_one / _other）

```json
// resources/zh-CN/home.json
{
  "records_one": "{{count}} 条记录",
  "records_other": "{{count}} 条记录"
}
```

```tsx
t('records', { count: 1 })   // → "1 条记录"  (records_one)
t('records', { count: 5 })   // → "5 条记录"  (records_other)
```

中文实际两种 plural form 文案常一致，保留 `_one` / `_other` 二元写法便于切英文时无痛。

### 数组（推荐问题等）

```json
// resources/zh-CN/ai.json
{ "suggestions": { "list": ["问题1", "问题2", "问题3"] } }
```

```tsx
const suggestions = (t('suggestions.list', { returnObjects: true }) ?? []) as string[]
```

---

## 4. 已接入范围（截至 v7.2 Sprint 1）

| 模块 | NS | 任务 |
|---|---|---|
| `app/layout/main-layout` | `nav` | T-S1-F8-02 |
| `pages/home` | `home` | T-S1-F8-03 |
| `pages/record` | `record` | T-S1-F8-03 |
| `pages/report` | `report` | T-S1-F8-04 |
| `pages/ai-assistant` | `ai` | T-S1-F8-04 |
| `pages/settings` | `settings` | T-S1-F8-04 |
| `components/language-switcher` | `settings` | T-S1-F8-05 |

**共享 NS**：`common` / `nav` 可被所有页面跨 NS 引用。

**未接入**（v7.3+ 渐进迁移）：discover / profile / baby / family / growth / vaccine / milestone / jaundice / auth/*

---

## 5. 验证当前语言切换

DevTools Console：

```js
// 查看当前语言
localStorage.getItem('baby_care_lang')

// 模拟切英文（v7.2 仅 fallback，看到 key 直显）
localStorage.setItem('baby_care_lang', 'en-US')
location.reload()

// 切回简中
localStorage.setItem('baby_care_lang', 'zh-CN')
location.reload()
```

---

## 6. 命名约定

- **命名空间**：小写 + 短横线（`ai-assistant` 用 `ai`）
- **Key**：嵌套对象 + 小写下划线，如 `hero.title` / `quota.left`
- **占位符**：`{{camelCase}}`，如 `{{babyName}}` / `{{count}}`
- **错误码 → 文案映射**：放 `common.errors.{code}`

详细规范见 `docs/web-coding-conventions.md §20`。

---

## 7. 与 User.preferences 的联动（INF-01）

```
用户切换语言
   │
   ▼
LanguageSwitcher.setLanguage(lang)
   │
   ├─► i18n.changeLanguage(lang)    ← 本地立即生效 + 写 localStorage
   │
   └─► useAuthStore.updatePreferences({ lang, langManuallySet: true })
           │
           ▼
       PATCH /api/auth/profile { preferences: { lang } }
           │
           ▼
       server 顶层 key 级深合并
           │
           ▼
       下次另一台设备登录 → auth-store.user.preferences.lang → i18n 自动应用
```

v7.2 仅 zh-CN 时，LanguageSwitcher 为 disabled 占位；v7.3+ 启用切换后该流程立即生效，无需改 preferences 字段。

---

## 8. 性能边界

- **vendor-i18n chunk gzip**：保持 < 50KB（当前 ~20KB），新增大型 NS 资源若导致超阈值，应改为 `i18next-http-backend` 按需异步加载
- **单个 NS JSON**：不超过 200 行，否则拆分（如 `home` 可分 `home.hero` / `home.timeline`）
- **避免动态 key**：不要在 render 中 `t(\`hero.${type}\`)`，会失去 ESLint / 静态分析能力；用 switch + 字面量 key

---

## 9. 常见问题

**Q：切换语言后部分文案没变？**
A：检查组件 `useTranslation('xxx')` 的命名空间是否在 `NAMESPACES` 里注册过。

**Q：开发态控制台一直 warn `missing key`？**
A：故意的（见 `index.ts` 的 `missingKeyHandler`），便于发现 typo。生产构建不输出。

**Q：Suspense 报错？**
A：本框架显式 `useSuspense: false`，避免与 React.lazy 路由 fallback 冲突。如需切回 Suspense 模式，需要同步包裹 `<Suspense>` 在 RouterProvider 外层。

**Q：`t()` 能返回对象或数组吗？**
A：可以，用 `t('key', { returnObjects: true })`；记得类型断言。常用于 `ai.suggestions.list` 这种数组资源。

**Q：如何让 NS 按路由懒加载？**
A：v7.2 同步 import 所有 NS，bundle 影响可接受（~16KB gzip）。如果未来 NS 数量膨胀到 20+ 或单 NS 大于 100 行文案，可引入 `i18next-http-backend` 或按 `import()` 懒 register；届时 `useSuspense` 需重新考虑。

---

## 10. 相关文档

- [`client/src/i18n/README.md`](../client/src/i18n/README.md) — 模块内快速参考（key 命名 / 复数 / 切换验证）
- [`docs/web-coding-conventions.md §20`](./web-coding-conventions.md) — 项目级规范（强制接入范围 + 反例 + ESLint 计划）
- [`docs/web-architecture.md §5.8`](./web-architecture.md) — 架构决策（初始化时序 / 与 lazy 路由兼容）
- [`docs/web-roadmap-v7.2-sprint1-design.md §5`](./web-roadmap-v7.2-sprint1-design.md) — Sprint 1 F8 详细设计
- [`docs/web-roadmap-v7.2-sprint1-tasks.md`](./web-roadmap-v7.2-sprint1-tasks.md) — T-S1-F8-01..05 任务拆分
