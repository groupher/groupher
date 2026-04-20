// useTwBelt/index.ts

import { clsx } from 'clsx'
import { useMemo } from 'react'

import { COLOR } from '~/const/colors'
import THEME from '~/const/theme'
import { cn, cnMerge } from '~/css'
import { camelize } from '~/fmt'
import useAvatarLayout from '~/hooks/useAvatarLayout'
import useMetric from '~/hooks/useMetric'
import usePrimaryColor from '~/hooks/usePrimaryColor'
import useSubPrimaryColor from '~/hooks/useSubPrimaryColor'
import type { TColorName, TZIndexType } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'
import { cachedMargin, keyToClass, RAINBOW_ALIAS, STATIC_CLS } from './constant'
import type {
  TBgKey,
  TBorderKey,
  TColorPrefix,
  TCutWWidth,
  TDimLevel,
  TFillKey,
  THoverPart,
  TLinkColorPrefix,
  TMenuPart,
  TRet,
  TShadowType,
  TTextKey,
} from './spec'

export default function useTwBelt(): TRet {
  const metric = useMetric()
  const { isSquare: isAvatarSquare } = useAvatarLayout()
  const primaryColor = usePrimaryColor()
  const subPrimaryColor = useSubPrimaryColor()
  const { pageBg, pageBgDark } = useDashboard()

  const metricLower = metric.toLowerCase()
  const containerClass = `container-${metricLower}`

  const resolvePageClass = (value: string, mode: 'light' | 'dark') => {
    if (value === COLOR.CUSTOM) {
      return mode === THEME.LIGHT ? 'page-customLight' : 'page-customDark'
    }

    return `page-${camelize(value)}`
  }

  // keep your page-bg strategy (no flash)
  const pageLightClass = resolvePageClass(pageBg, THEME.LIGHT)
  const pageDarkClass = resolvePageClass(pageBgDark, THEME.DARK)

  /**
   * ✅ New token scheme:
   * - fg('digest') -> text-digest
   * - bg('modal.mask') -> bg-modal-mask
   * - br('table.border') -> border-table-border
   */
  const fg = (key: TTextKey | `${string}.${string}`) => keyToClass('text', key)
  const bg = (key: TBgKey | `${string}.${string}`) => keyToClass('bg', key)
  const fill = (key: TFillKey | `${string}.${string}`) => keyToClass('fill', key)
  const br = (key: TBorderKey | `${string}.${string}`) => keyToClass('border', key)

  const rainbow = (color: TColorName, prefix: TColorPrefix = 'fg'): string => {
    const prefix$ = RAINBOW_ALIAS[prefix]
    const color$ = camelize(color)

    if (prefix === 'bgSoft') {
      return `${prefix$}-${color$}Soft`
    }

    if (prefix === 'borderSoft') {
      return `${prefix$}-${color$}/50`
    }

    return `${prefix$}-${color$}`
  }

  const rainbowSoft = (color: TColorName | string): string => {
    const color$ = camelize(color)
    return `bg-rainbow-${color$}Soft`
  }

  const resolveCustomRainbowToken = (
    color: TColorName,
    customKey: 'custom' | 'subCustom',
    prefix: TColorPrefix,
  ): string => {
    if (color !== COLOR.CUSTOM) {
      return rainbow(color, prefix)
    }

    const prefix$ = RAINBOW_ALIAS[prefix]

    if (prefix === 'bgSoft') {
      return `${prefix$}-${customKey}Soft`
    }

    if (prefix === 'borderSoft') {
      return `${prefix$}-${customKey}/50`
    }

    return `${prefix$}-${customKey}`
  }

  const primary = (prefix: TColorPrefix = 'fg'): string => rainbow(primaryColor, prefix)
  const subPrimary = (prefix: TColorPrefix = 'fg'): string =>
    resolveCustomRainbowToken(subPrimaryColor, 'subCustom', prefix)

  const linker = (prefix: TLinkColorPrefix = 'fg'): string => {
    return resolveCustomRainbowToken(
      subPrimaryColor,
      'subCustom',
      prefix as unknown as TColorPrefix,
    )
  }

  const linkable = () => STATIC_CLS.linkable

  const hoverBr = () => cn(STATIC_CLS.hoverBrBase, br('divider'), `hover:${primary('borderSoft')}`)

  const hoverLink = (textSize = 'text-base') =>
    cn(
      STATIC_CLS.hoverLinkBase,
      textSize,
      `hover:${bg('hoverBg')}`,
      `hover:${fg('title')}`,
      primary('decoration'),
      fg('digest'),
    )

  const hoverLinkIcon = (size = 'size-3.5') =>
    cn(size, 'mr-1 group-smoky-65', `group-hover:${fill('title')}`, fill('digest'))

  /**
   * this is not typo, cause the existing param is `size`
   */
  const zise = (unit: number): string => clsx(`size-${unit}`)

  const divider = () => cn(STATIC_CLS.divider, bg('divider'))
  const VDivider = () => cn(STATIC_CLS.vDivider, fg('digest'))

  const sexyBorder = (turn = 35, classNames?: string) =>
    cn(STATIC_CLS.sexyBorderBase, `sexy-border-${turn}`, classNames)

  const sexyVBorder = (turn: number, classNames = '') =>
    cn(STATIC_CLS.sexyVBorderBase, `sexy-border-${turn}`, classNames)

  const avatar = (level: 'md' | 'sm' | '' = 'md') => {
    if (isAvatarSquare) return level === '' ? 'rounded' : `rounded-${level}`
    return 'circle'
  }

  const gradientBar = (color: TColorName): string =>
    `bg-gradient-to-r from-rainbow-${(color === COLOR.CUSTOM ? COLOR.BLACK : color).toLocaleLowerCase()}Bg to-transparent`

  const vividDark = (): string => STATIC_CLS.vividDarkWhenDark

  const dimDark = (level: TDimLevel = 'md'): string => {
    switch (level) {
      case 'sm':
        return 'dark:brightness-90'
      case 'lg':
        return 'dark:brightness-50'
      default:
        return 'dark:brightness-75'
    }
  }

  const shadow = (size: TShadowType): string => `shadow-${size}`

  const cut = (w: TCutWWidth = 'w-12'): string => {
    const maxWidth = w.replace('w-', 'max-w-')
    return cn(STATIC_CLS.cutBase, maxWidth)
  }

  const landingTitle = (): string => cn(STATIC_CLS.landingTitleBase, fg('title'))

  const hover = (part: THoverPart): string => {
    switch (part) {
      case 'bg':
      case 'box':
        return cn(STATIC_CLS.hoverBgBase, `hover:${bg('hoverBg')}`)
      case 'bg-red':
        return cn(STATIC_CLS.hoverBgBase, `hover:${rainbowSoft(COLOR.RED)}`)
      case 'icon':
        return cn(STATIC_CLS.hoverIconBase, fill('digest'), `group-hover:${fill('title')}`)
      case 'fg':
        return cn(STATIC_CLS.hoverIconBase, fg('digest'), `group-hover:${fg('title')}`)
      case 'fg-red':
        return cn(STATIC_CLS.hoverIconBase, fg('digest'), `group-hover:${rainbow(COLOR.RED, 'fg')}`)
      case 'icon-red':
        return cn(
          STATIC_CLS.hoverIconBase,
          fill('digest'),
          `group-hover:${rainbow(COLOR.RED, 'fill')}`,
        )
      default:
        return 'debug'
    }
  }

  const zIndex = (type: TZIndexType, visible?: boolean): string => {
    if (visible === false) return '-z-10'
    return `z-${type}`
  }

  const menu = (part: TMenuPart): string => {
    switch (part) {
      case 'bg':
        return bg('popover.bg')

      case 'bar':
        return cn(
          STATIC_CLS.menuBarBase,
          `hover:${fg('title')}`,
          `hover:${bg('menuHoverBg')}`,
          `hover:${br('divider')}`,
          fg('digest'),
        )

      case 'title':
        return cn(STATIC_CLS.menuTitleBase, `group-hover/menubar:${fg('title')}`)

      case 'icon':
        return cn(STATIC_CLS.menuIconBase, fill('digest'), `group-hover/menubar:${fill('title')}`)

      case 'activeBox':
        return cn(
          'opacity-100 scale-100',
          fg('title'),
          fill('title'),
          bg('menuHoverBg'),
          br('divider'),
          shadow('sm'),
        )

      case 'activeIcon':
        return fill('title')

      case 'link':
        return cn(STATIC_CLS.menuLinkBase, fill('digest'))

      default:
        return ''
    }
  }

  const page = () => `${pageLightClass} ${pageDarkClass}`

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  return useMemo<TRet>(
    () => ({
      cn,
      cnMerge,

      container: () => containerClass,

      fg,
      bg,
      fill,
      br,

      hoverBr,

      rainbow,
      rainbowSoft,
      primary,
      subPrimary,
      linker,

      linkable,
      hoverLink,
      hoverLinkIcon,

      zise,
      margin: cachedMargin,

      divider,
      VDivider,

      sexyBorder,
      sexyVBorder,

      avatar,
      gradientBar,

      vividDark,
      dimDark,

      menu,

      shadow,
      cut,
      landingTitle,

      hover,
      zIndex,

      page,
    }),
    // deps: only those that can affect returned behaviors/strings
    [containerClass, pageLightClass, pageDarkClass, isAvatarSquare, primaryColor, subPrimaryColor],
  )
}
