/**
 * AuthLayout v7 - iOS Health × 美拉德暖色
 *
 * 改造要点：
 * - 废弃 gradient-primary 全屏背景，改为 surface-0 暖米底 + 顶部品牌色晕（body 自带）
 * - 废弃玻璃态 Card variant="glass"，改为 hero Card
 * - 桌面端左右分屏：左 brand-soft 品牌 Hero 区，右 surface-1 表单区
 * - 移动端：表单居中 + 上方品牌 Hero
 */
import { Outlet, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth-store'
import { Baby } from 'lucide-react'
import { Footer } from '@/components/footer'
import { Card } from '@/components/ui/card'
import { staggerContainer, staggerItem } from '@/lib/motion'

export function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row"
      style={{ backgroundColor: 'var(--surface-0)' }}
    >
      {/* 左侧品牌区：仅桌面端。用 brand-soft 奶茶白做纯净 Hero，不用渐变 */}
      <div
        className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col justify-center px-12 lg:px-20 relative overflow-hidden"
        style={{ backgroundColor: 'var(--brand-soft)' }}
      >
        {/* 装饰：右下角大号品牌色圆晕 */}
        <div
          className="pointer-events-none absolute -right-40 -bottom-40 w-[520px] h-[520px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--brand) 48%, transparent), transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        <motion.div
          className="max-w-lg relative z-10"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <motion.div
            variants={staggerItem}
            className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center mb-8"
            style={{
              backgroundColor: 'var(--brand)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <Baby className="w-9 h-9" style={{ color: 'var(--surface-1)' }} strokeWidth={2.2} />
          </motion.div>
          <motion.h1
            variants={staggerItem}
            className="large-title mb-4"
            style={{ color: 'var(--brand-ink)' }}
          >
            Baby Care
            <br />
            Tracker
          </motion.h1>
          <motion.p
            variants={staggerItem}
            className="body"
            style={{ color: 'var(--label-secondary)', lineHeight: 1.6 }}
          >
            科学育儿，安心记录
            <br />
            记录宝宝成长的每一天
          </motion.p>
        </motion.div>
      </div>

      {/* 右侧表单区 */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 md:px-10">
        {/* 移动端品牌区 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="md:hidden flex flex-col items-center mb-6"
        >
          <div
            className="w-14 h-14 rounded-[16px] flex items-center justify-center mb-3"
            style={{
              backgroundColor: 'var(--brand)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Baby className="w-7 h-7" style={{ color: 'var(--surface-1)' }} strokeWidth={2.2} />
          </div>
          <h1 className="title-3" style={{ color: 'var(--brand-ink)' }}>
            Baby Care Tracker
          </h1>
        </motion.div>

        {/* 表单容器 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="w-full max-w-md"
        >
          <Card variant="hero" padding="lg">
            <Outlet />
          </Card>
        </motion.div>
        <Footer />
      </div>
    </div>
  )
}
