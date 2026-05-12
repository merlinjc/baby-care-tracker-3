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
 *    <UserAvatar user={user} size="md" />   // 无头像时取昵称首字 + 哈希配色
 *
 * Size：xs(24) / sm(32) / md(40) / lg(48) / xl(64)；完整覆盖从 TabBar 到 Profile 头像的全部需求。
 *
 * v7.2 F12-01：
 * - `BabyAvatar` / `UserAvatar` 的 avatar 字段语义从"绝对 URL"改为"桶内 key"（由 T-S1-INF-02 引入），
 *   组件内部自动调用 `buildImageUrl(keyOrUrl)` 拼 `/api/uploads/{key}`；对历史 http(s)://... 数据原样返回。
 * - 未设置 avatar 时 fallback 升级为「哈希确定性色块 + 首字 SVG」：同一昵称永远同色，
 *   取代原先固定 primary 背景的 ASCII fallback。SVG 由 `lib/default-avatar` 生成，0 KB 网络开销。
 */
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { buildImageUrl } from '@/lib/image-url'
import {
  firstGlyph,
  getDefaultAvatarDataUri,
  pickAvatarColor,
} from '@/lib/default-avatar'
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
  const avatarSrc = buildImageUrl(baby.avatar)
  return (
    <Avatar size={size} bordered={bordered} className={className}>
      {avatarSrc && <AvatarImage src={avatarSrc} alt={baby.name} />}
      <AvatarFallback
        bgColor={babyAvatarColor(baby.gender)}
        textSize={size}
        aria-label={baby.name}
      >
        {firstGlyph(baby.name)}
      </AvatarFallback>
    </Avatar>
  )
}

interface UserAvatarProps {
  user: { nickname?: string | null; avatar?: string | null }
  size?: AvatarSize
  bordered?: boolean
  className?: string
  /**
   * 自定义 fallback 背景色（覆盖默认的"昵称哈希色"）。
   * 不传时根据 nickname 确定性哈希到 8 档暖色之一，同一昵称永远同色。
   */
  fallbackBgColor?: string
}

/**
 * UserAvatar - 用户头像
 *
 * - `user.avatar` 可以是旧 URL 或新 COS key，内部 `buildImageUrl` 统一拼代理 URL
 * - 无头像时用"昵称哈希色块 + 首字"兜底，不再是固定 primary 底色
 */
export function UserAvatar({
  user,
  size = 'md',
  bordered,
  className,
  fallbackBgColor,
}: UserAvatarProps) {
  const nickname = user.nickname ?? ''
  const name = nickname || '?'
  const avatarSrc = buildImageUrl(user.avatar)
  const bg = fallbackBgColor ?? pickAvatarColor(nickname)
  return (
    <Avatar size={size} bordered={bordered} className={className}>
      {avatarSrc && <AvatarImage src={avatarSrc} alt={name} />}
      <AvatarFallback bgColor={bg} textSize={size}>
        {firstGlyph(nickname)}
      </AvatarFallback>
    </Avatar>
  )
}

/**
 * 生成默认 SVG 头像 dataURI（非 React 组件）。
 *
 * 用于需要把"默认头像"作为 `<img src>` 的场景（如 canvas 渲染、分享图、小组件）。
 * 组件内展示优先使用 `<BabyAvatar>` / `<UserAvatar>` 自动走 fallback 链。
 */
export { getDefaultAvatarDataUri }

export { avatarRootVariants }
