/**
 * Avatar - 头像组件
 *
 * 基于 @radix-ui/react-avatar（内置 image 加载失败自动 fallback）。
 *
 * 3 种用法：
 *
 * 1. 组合式（灵活）：
 *    <Avatar size="md"><AvatarImage src={url} alt={name} /><AvatarFallback>W</AvatarFallback></Avatar>
 *
 * 2. 快捷式（Baby / User 专用）：
 *    <BabyAvatar baby={baby} size="md" />   // 根据 gender 自动配色 + 取首字
 *    <UserAvatar user={user} size="md" />   // 无头像时取昵称首字 + primary 底色
 *
 * Size：xs(24) / sm(32) / md(40) / lg(48) / xl(64)；完整覆盖从 TabBar 到 Profile 头像的全部需求。
 */
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import type { Baby } from '@/types'

const avatarSizes = {
  xs: { wrap: 'h-6 w-6', text: 'text-[10px]' },
  sm: { wrap: 'h-8 w-8', text: 'text-xs' },
  md: { wrap: 'h-10 w-10', text: 'text-sm' },
  lg: { wrap: 'h-12 w-12', text: 'text-base' },
  xl: { wrap: 'h-16 w-16', text: 'text-xl' },
} as const

export type AvatarSize = keyof typeof avatarSizes

const avatarRootVariants = cva(
  'relative inline-flex shrink-0 overflow-hidden rounded-full select-none',
  {
    variants: {
      size: {
        xs: avatarSizes.xs.wrap,
        sm: avatarSizes.sm.wrap,
        md: avatarSizes.md.wrap,
        lg: avatarSizes.lg.wrap,
        xl: avatarSizes.xl.wrap,
      },
      bordered: {
        true: 'ring-2 ring-[var(--bg-card)]',
        false: '',
      },
    },
    defaultVariants: { size: 'md', bordered: false },
  },
)

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarRootVariants> {}

export const Avatar = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, bordered, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    data-size={size ?? 'md'}
    className={cn(avatarRootVariants({ size, bordered }), className)}
    {...props}
  />
))
Avatar.displayName = 'Avatar'

export const AvatarImage = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full object-cover', className)}
    {...props}
  />
))
AvatarImage.displayName = 'AvatarImage'

export interface AvatarFallbackProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
  /** 可选背景色（自定义渐变或单色）；不传时使用父 Avatar 内联 style 或默认 primary */
  bgColor?: string
  /** 可选字号覆盖；默认跟随父 Avatar 的 size */
  textSize?: AvatarSize
}

export const AvatarFallback = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, bgColor, textSize, style, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center font-semibold text-white',
      textSize && avatarSizes[textSize].text,
      className,
    )}
    style={{
      backgroundColor: bgColor ?? 'var(--primary)',
      ...style,
    }}
    {...props}
  />
))
AvatarFallback.displayName = 'AvatarFallback'

// ========= 快捷封装 =========

/** 根据宝宝性别自动配色（男=growth 蓝 / 女=temperature 粉） */
export function babyAvatarColor(gender: Baby['gender']): string {
  return gender === 'female' ? 'var(--temperature)' : 'var(--growth)'
}

interface BabyAvatarProps {
  baby: Baby
  size?: AvatarSize
  bordered?: boolean
  className?: string
}

/** BabyAvatar - 宝宝头像（自动 gender 配色 + 名字首字 fallback） */
export function BabyAvatar({ baby, size = 'md', bordered, className }: BabyAvatarProps) {
  return (
    <Avatar size={size} bordered={bordered} className={className}>
      {baby.avatar && <AvatarImage src={baby.avatar} alt={baby.name} />}
      <AvatarFallback
        bgColor={babyAvatarColor(baby.gender)}
        textSize={size}
        aria-label={baby.name}
      >
        {baby.name.charAt(0)}
      </AvatarFallback>
    </Avatar>
  )
}

interface UserAvatarProps {
  user: { nickname?: string | null; avatar?: string | null }
  size?: AvatarSize
  bordered?: boolean
  className?: string
  /** 自定义 fallback 背景色（默认 primary） */
  fallbackBgColor?: string
}

/** UserAvatar - 用户头像（无头像时取昵称首字 + primary 底色） */
export function UserAvatar({
  user,
  size = 'md',
  bordered,
  className,
  fallbackBgColor,
}: UserAvatarProps) {
  const name = user.nickname ?? '?'
  return (
    <Avatar size={size} bordered={bordered} className={className}>
      {user.avatar && <AvatarImage src={user.avatar} alt={name} />}
      <AvatarFallback bgColor={fallbackBgColor} textSize={size}>
        {name.charAt(0)}
      </AvatarFallback>
    </Avatar>
  )
}

export { avatarRootVariants }
