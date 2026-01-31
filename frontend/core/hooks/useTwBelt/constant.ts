// useTwBelt/constant.ts

import type { TSpace } from '~/spec'
import type { TColorPrefix } from './spec'

export const STATIC_CLS = {
  linkable: 'no-underline pointer hover:underline',

  divider: 'w-full h-px',
  vDivider: 'w-px h-3 ml-1.5 mr-1.5',

  hoverBrBase: 'border trans-all-100',

  hoverLinkBase:
    'row-center group px-1.5 py-0.5 rounded trans-all-100 underline-offset-8 hover:underline decoration-1',

  menuBarBase:
    'group/menubar row-center text-sm w-full border border-transparent rounded-md pointer px-1.5 py-1 cursor-pointer bold-none trans-all-100 hover:bold-none',

  menuTitleBase: 'text-sm grow',
  menuIconBase: 'size-3 mr-2.5',
  menuLinkBase: 'size-3.5 opacity-0 group-hover/menubar:opacity-60',

  hoverBgBase: 'group align-both rounded trans-all-100 pointer',
  hoverIconBase: 'trans-all-100',

  landingTitleBase: 'text-3xl bold-sm opacity-70 dark:opacity-90 text-shadow dark:text-shadow-none',

  sexyBorderBase: 'h-px w-full border-b',
  sexyVBorderBase: 'h-full w-px border-l',

  cutBase: 'truncate w-fit w-auto',

  vividDarkWhenDark: 'dark:saturate-150 dark:brightness-125',
} as const

export const DIR: Record<keyof TSpace, string> = {
  top: 'mt',
  bottom: 'mb',
  left: 'ml',
  right: 'mr',
} as const

export const RAINBOW_ALIAS: Record<TColorPrefix, string> = {
  fg: 'text-rainbow',
  bg: 'bg-rainbow',
  bgSoft: 'bg-rainbow', // special-cased
  fill: 'fill-rainbow',
  border: 'border-rainbow',
  borderSoft: 'border-rainbow', // special-cased
  decoration: 'decoration-rainbow',
} as const

/**
 * className cache (prefix is already implied by fg/bg/etc).
 * cacheKey format: `${prefix}|${key}` e.g. "text|digest" or "bg|modal.mask"
 * value: "text-digest" or "bg-modal-mask"
 */
export const THEME_KEY_CACHE = new Map<string, string>()

export function keyToClass(prefix: string, key: string): string {
  const cacheKey = `${prefix}|${key}`
  const cached = THEME_KEY_CACHE.get(cacheKey)
  if (cached) return cached

  const value = `${prefix}-${key.replace(/\./g, '-')}`
  THEME_KEY_CACHE.set(cacheKey, value)
  return value
}

const MARGIN_CACHE = new Map<string, string>()
const MARGIN_CACHE_MAX = 512

export function cachedMargin(spacing: TSpace): string {
  const t = spacing.top ?? ''
  const b = spacing.bottom ?? ''
  const l = spacing.left ?? ''
  const r = spacing.right ?? ''
  const key = `${t}|${b}|${l}|${r}`

  const hit = MARGIN_CACHE.get(key)
  if (hit) return hit

  const res: string[] = []
  if (spacing.top !== undefined) {
    const v = spacing.top
    res.push(v !== 'px' && v < 0 ? `-mt-${Math.abs(v)}` : `mt-${v}`)
  }
  if (spacing.bottom !== undefined) {
    const v = spacing.bottom
    res.push(v !== 'px' && v < 0 ? `-mb-${Math.abs(v)}` : `mb-${v}`)
  }
  if (spacing.left !== undefined) {
    const v = spacing.left
    res.push(v !== 'px' && v < 0 ? `-ml-${Math.abs(v)}` : `ml-${v}`)
  }
  if (spacing.right !== undefined) {
    const v = spacing.right
    res.push(v !== 'px' && v < 0 ? `-mr-${Math.abs(v)}` : `mr-${v}`)
  }

  const out = res.join(' ')
  if (MARGIN_CACHE.size >= MARGIN_CACHE_MAX) MARGIN_CACHE.clear()
  MARGIN_CACHE.set(key, out)
  return out
}
