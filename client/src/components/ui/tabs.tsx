/**
 * Tabs - 标签切换
 *
 * 基于 @radix-ui/react-tabs。对标 shadcn/ui。
 *
 * 2 种 variant：
 * - 'underline'（默认）：底部下划线指示器，适合主内容切换（记录页类型筛选）
 * - 'pill'：胶囊背景，适合次级选项（报告页周/月切换）
 *
 * Size：sm / md。
 *
 * radix 自带键盘：← → 切换、Home/End 首尾跳转；自动 `role="tab/tabpanel"` + `aria-selected`。
 */
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

// ============ TabsList ============

const tabsListVariants = cva(
  'inline-flex items-center shrink-0',
  {
    variants: {
      variant: {
        underline: 'gap-4 border-b border-[var(--border-light)] w-full',
        pill: 'gap-1 rounded-full p-1 bg-[var(--bg-elevated)]',
      },
    },
    defaultVariants: { variant: 'underline' },
  },
)

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

export const TabsList = forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    data-variant={variant ?? 'underline'}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

// ============ TabsTrigger ============

const tabsTriggerVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
    'font-medium transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
    'cursor-pointer',
  ].join(' '),
  {
    variants: {
      variant: {
        underline: [
          'py-2.5 px-0.5 text-sm -mb-px border-b-2 border-transparent',
          'text-[var(--text-hint)]',
          'hover:text-[var(--text-primary)]',
          'data-[state=active]:text-[var(--primary-dark)]',
          'data-[state=active]:border-[var(--primary)]',
        ].join(' '),
        pill: [
          'px-3 py-1.5 text-xs rounded-full',
          'text-[var(--text-secondary)]',
          'hover:text-[var(--text-primary)]',
          'data-[state=active]:bg-[var(--bg-card)]',
          'data-[state=active]:text-[var(--text-primary)]',
          'data-[state=active]:shadow-[var(--shadow-soft)]',
        ].join(' '),
      },
      size: {
        sm: '',
        md: '',
      },
    },
    defaultVariants: { variant: 'underline', size: 'md' },
  },
)

export interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

export const TabsTrigger = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant, size, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant, size }), className)}
    {...props}
  />
))
TabsTrigger.displayName = 'TabsTrigger'

// ============ TabsContent ============

export const TabsContent = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'outline-none mt-4',
      'focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 rounded-md',
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = 'TabsContent'

export { tabsListVariants, tabsTriggerVariants }
