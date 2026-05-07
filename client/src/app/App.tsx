import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from './routes'
import { Toaster } from '@/components/ui/toast'
import { ConfirmHost } from '@/components/ui/confirm-dialog'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cleanupLegacyPreferredCareRole } from '@/lib/care-role'

// v5.0.0+：清理旧版"手动切换视角"残留的 localStorage 键（一次性迁移）
cleanupLegacyPreferredCareRole()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* 全局 Tooltip 延迟 300ms；单个 <Tooltip> 可通过自身 delayDuration 覆盖 */}
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
        <Toaster />
        <ConfirmHost />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
