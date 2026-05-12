# Web 端 i18n 使用指南

> 模块：`client/src/i18n/`
> 引入版本：v7.2 Sprint 1（F8）
> 依赖：`react-i18next` + `i18next` + `i18next-browser-languagedetector`

## 1. 当前状态

- **完整支持**：`zh-CN`（简体中文）
- **预留接口**：英文 / 繁中（v7.3+ 启用）
- **检测顺序**：`localStorage('baby_care_lang')` → `navigator.language`，命中失败回落 `zh-CN`

## 2. 在组件里使用

### 基础用法

```tsx
import { useTranslation } from 'react-i18next'

export function HomePage() {
  const { t } = useTranslation('home')   // 命名空间 = home

  return <h1>{t('hero.title')}</h1>      // 取 resources/zh-CN/home.json 里的 hero.title
}
```

### 跨命名空间

```tsx
const { t } = useTranslation(['home', 'common'])   // 同时引入多个 ns

t('hero.title')          // 默认从第一个 ns（home）取
t('actions.save', { ns: 'common' })  // 显式指定 ns
```

### 占位符

```tsx
// resources/zh-CN/common.json
// "time": { "minutes_ago": "{{count}} 分钟前" }
t('time.minutes_ago', { count: 5 })   // → "5 分钟前"
```

### 复数

i18next 自带复数后缀：`xxx_one` / `xxx_other`

```json
{
  "records_one": "{{count}} 条记录",
  "records_other": "{{count}} 条记录"
}
```

```tsx
t('records', { count: 1 })   // → "1 条记录"  (records_one)
t('records', { count: 5 })   // → "5 条记录"  (records_other)
```

中文实际两种 plural form 文案常一致，但保留 `_one` / `_other` 二元写法便于切英文时无痛。

## 3. 添加新文案

### 在已有命名空间增加 key

直接编辑 `resources/zh-CN/{ns}.json`：

```json
{
  "hero": {
    "title": "你好，{{babyName}}",
    "subtitle": "记录温柔的日常"     // ← 新增
  }
}
```

业务层：`t('hero.subtitle')`

### 新建命名空间

1. 新建 `resources/zh-CN/{ns}.json`
2. 在 `client/src/i18n/index.ts`：
   ```ts
   import zhMyNs from './resources/zh-CN/my-ns.json'
   const RESOURCES = { 'zh-CN': { ...其他, 'my-ns': zhMyNs } }
   export const NAMESPACES = [...其他, 'my-ns'] as const
   ```
3. 业务层：`useTranslation('my-ns')`

## 4. Sprint 1 强制接入范围

按设计文档 §5.3，以下 5 页 + 2 公共区文案必须走 `t()`：

| 页面 / 模块 | 命名空间 | 状态（Sprint 1 末） |
|-----------|---------|-------------------|
| `app/layout/main-layout.tsx` | `nav` | F8-02 |
| `pages/home` | `home` | F8-03 |
| `pages/record` | `record` | F8-03 |
| `pages/report` | `report` | F8-04 |
| `pages/ai-assistant` | `ai` | F8-04 |
| `pages/settings` | `settings` | F8-04 |

**未抽取的页面**（v7.3+ 渐进迁移）：discover / profile / baby / family / growth / vaccine / milestone / jaundice / auth/*

## 5. 验证当前语言切换

打开 DevTools Console：

```js
// 查看当前语言
localStorage.getItem('baby_care_lang')
// → 'zh-CN' / null（未设置）

// 模拟切英文（v7.2 仅 fallback，看到 key 直显）
localStorage.setItem('baby_care_lang', 'en-US')
location.reload()

// 切回简中
localStorage.setItem('baby_care_lang', 'zh-CN')
location.reload()
```

## 6. 命名约定

- **命名空间**：小写 + 短横线（`ai-assistant` 用 `ai`）
- **Key**：嵌套对象 + 小写下划线，如 `hero.title` / `quota.left`
- **占位符**：`{{camelCase}}`，如 `{{babyName}}` / `{{count}}`
- **错误码 → 文案映射**：放 `common.errors.{code}`（如 `common.errors.network`）

## 7. ESLint 防回退（计划，Sprint 3 a11y 阶段）

将引入自定义规则 `no-hardcoded-chinese`：

- 仅对 5 高频页面 + main-layout 生效
- 检测 JSX text / 字符串字面量中直接出现 `[\u4e00-\u9fff]+`
- 触发后报错并提示用 `t()` 抽离

Sprint 1 不强制，靠 PR review。

## 8. 性能注意事项

- 资源同步 import 进 `i18n/index.ts` → 进入应用入口 chunk（~10KB gzip）
- 单 ns JSON 不超过 200 行，否则考虑拆 ns
- 不要在 useEffect 里调用 `i18n.changeLanguage()` —— 会触发整树重渲染；交给 `LanguageSwitcher` 组件统一管控

## 9. 常见问题

**Q：切换语言后部分文案没变？**
A：检查组件 `useTranslation('xxx')` 的命名空间是否在 `NAMESPACES` 里注册过。

**Q：开发态控制台一直 warn `missing key`？**
A：故意的（见 `index.ts` 的 `missingKeyHandler`），便于发现 typo。生产构建不输出。

**Q：Suspense 报错？**
A：本框架显式 `useSuspense: false`，避免与 React.lazy 路由 fallback 冲突。如需切回 Suspense 模式，需要同步包裹 `<Suspense>` 在 RouterProvider 外层。
