/**
 * 路由表（F9 路由级代码分割版）
 *
 * 改造点：
 * - 14 个 page 全部走 React.lazy + 动态 import()，每个 page 单独 chunk
 * - 统一通过 lazyEl() 包装，避免在每个 route 重复写 Suspense
 * - MainLayout / AuthLayout 保持 eager 加载（首屏必要框架）
 *
 * 命名导出 → default 的转换：
 *   现有 page 都是命名导出（export function HomePage(){}），React.lazy 要求
 *   返回 default 导出的 Promise，因此用 .then(m => ({ default: m.HomePage })) 适配。
 */
import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense, type LazyExoticComponent, type ComponentType } from 'react'
import { MainLayout } from '@/app/layout/main-layout'
import { AuthLayout } from '@/app/layout/auth-layout'
import { RouteFallback } from '@/app/layout/route-fallback'

// ─── Main Layout 内的页面 ──────────────────────────────────────────────
const HomePage = lazy(() =>
  import('@/pages/home').then((m) => ({ default: m.HomePage })),
)
const RecordPage = lazy(() =>
  import('@/pages/record').then((m) => ({ default: m.RecordPage })),
)
const DiscoverPage = lazy(() =>
  import('@/pages/discover').then((m) => ({ default: m.DiscoverPage })),
)
const ProfilePage = lazy(() =>
  import('@/pages/profile').then((m) => ({ default: m.ProfilePage })),
)
const BabyPage = lazy(() =>
  import('@/pages/baby').then((m) => ({ default: m.BabyPage })),
)
const FamilyPage = lazy(() =>
  import('@/pages/family').then((m) => ({ default: m.FamilyPage })),
)
const GrowthPage = lazy(() =>
  import('@/pages/growth').then((m) => ({ default: m.GrowthPage })),
)
const VaccinePage = lazy(() =>
  import('@/pages/vaccine').then((m) => ({ default: m.VaccinePage })),
)
const MilestonePage = lazy(() =>
  import('@/pages/milestone').then((m) => ({ default: m.MilestonePage })),
)
const AiAssistantPage = lazy(() =>
  import('@/pages/ai-assistant').then((m) => ({ default: m.AiAssistantPage })),
)
const JaundicePage = lazy(() =>
  import('@/pages/jaundice').then((m) => ({ default: m.JaundicePage })),
)
const ReportPage = lazy(() =>
  import('@/pages/report').then((m) => ({ default: m.ReportPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/settings').then((m) => ({ default: m.SettingsPage })),
)

// ─── Auth Layout 内的页面 ──────────────────────────────────────────────
const LoginPage = lazy(() =>
  import('@/pages/auth/login').then((m) => ({ default: m.LoginPage })),
)
const RegisterPage = lazy(() =>
  import('@/pages/auth/register').then((m) => ({ default: m.RegisterPage })),
)
const WechatCallbackPage = lazy(() =>
  import('@/pages/auth/wechat-callback').then((m) => ({ default: m.WechatCallbackPage })),
)

// 通用 Suspense 包装，避免每个 route 重复声明
const lazyEl = (El: LazyExoticComponent<ComponentType>) => (
  <Suspense fallback={<RouteFallback />}>
    <El />
  </Suspense>
)

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: '/', element: lazyEl(HomePage) },
      { path: '/record', element: lazyEl(RecordPage) },
      { path: '/discover', element: lazyEl(DiscoverPage) },
      { path: '/profile', element: lazyEl(ProfilePage) },
      { path: '/baby', element: lazyEl(BabyPage) },
      { path: '/family', element: lazyEl(FamilyPage) },
      { path: '/growth', element: lazyEl(GrowthPage) },
      { path: '/vaccine', element: lazyEl(VaccinePage) },
      { path: '/milestone', element: lazyEl(MilestonePage) },
      { path: '/ai-assistant', element: lazyEl(AiAssistantPage) },
      { path: '/jaundice', element: lazyEl(JaundicePage) },
      { path: '/report', element: lazyEl(ReportPage) },
      { path: '/settings', element: lazyEl(SettingsPage) },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: lazyEl(LoginPage) },
      { path: '/register', element: lazyEl(RegisterPage) },
      { path: '/auth/wechat/callback', element: lazyEl(WechatCallbackPage) },
    ],
  },
])
