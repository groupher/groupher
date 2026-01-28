// useTwBelt/index.ts

import { clsx } from 'clsx'
import { useMemo } from 'react'

import { COLOR_NAME } from '~/const/colors'
import { cn, cnMerge } from '~/css'
import { camelize } from '~/fmt'
import useAvatarLayout from '~/hooks/useAvatarLayout'
import useDashboard from '~/hooks/useDashboard'
import useMetric from '~/hooks/useMetric'
import usePrimaryColor from '~/hooks/usePrimaryColor'
import useTheme from '~/hooks/useTheme'
import type { TColorName, TZIndexType } from '~/spec'
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
  const { isLightTheme } = useTheme()
  const metric = useMetric()
  const { isSquare: isAvatarSquare } = useAvatarLayout()
  const primaryColor = usePrimaryColor()
  const { pageBg, pageBgDark } = useDashboard()

  const isDarkBlack = !isLightTheme && primaryColor === COLOR_NAME.BLACK
  const isBlackPrimary = primaryColor === COLOR_NAME.BLACK

  const metricLower = metric.toLowerCase()
  const containerClass = `container-${metricLower}`

  // keep your page-bg strategy (no flash)
  const pageLightClass = `page-${camelize(pageBg)}`
  const pageDarkClass = `page-${camelize(pageBgDark)}`

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
      if (color === COLOR_NAME.BLACK) return bg('hoverBg')
      return `${prefix$}-${color$}Soft`
    }

    if (prefix === 'borderSoft') {
      return `${prefix$}-${color$}/50`
    }

    return `${prefix$}-${color$}`
  }

  const rainbowSoft = (color: TColorName | string): string => {
    const color$ = camelize(color)
    if (color === COLOR_NAME.BLACK) return bg('hoverBg')
    return `bg-rainbow-${color$}Soft`
  }

  const primary = (prefix: TColorPrefix = 'fg'): string => rainbow(primaryColor, prefix)

  const linker = (prefix: TLinkColorPrefix = 'fg'): string => {
    if (primaryColor === COLOR_NAME.BLACK) {
      return prefix === 'fg' ? fg('link') : fill('link')
    }
    return rainbow(primaryColor, prefix as unknown as TColorPrefix)
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
    `bg-gradient-to-r from-rainbow-${color.toLocaleLowerCase()}Bg to-transparent`

  const vividDark = (): string => (!isLightTheme ? STATIC_CLS.vividDarkWhenDark : '')

  const dimDark = (level: TDimLevel = 'md'): string => {
    if (isLightTheme) return ''
    if (level === 'sm') return 'brightness-90'
    if (level === 'lg') return 'brightness-50'
    return 'brightness-75'
  }

  const shadow = (size: TShadowType): string => `shadow-${size}`

  const cut = (w: TCutWWidth = 'w-12'): string => {
    const maxWidth = w.replace('w-', 'max-w-')
    return cn(STATIC_CLS.cutBase, maxWidth)
  }

  const landingTitle = (): string =>
    cn(STATIC_CLS.landingTitleBase, fg('title'), isLightTheme && 'text-shadow')

  const hover = (part: THoverPart): string => {
    switch (part) {
      case 'bg':
        return cn(STATIC_CLS.hoverBgBase, `hover:${bg('hoverBg')}`)
      case 'bg-red':
        return cn(STATIC_CLS.hoverBgBase, `hover:${rainbowSoft(COLOR_NAME.RED)}`)
      case 'icon':
        return cn(STATIC_CLS.hoverIconBase, fill('digest'), `group-hover:${fill('title')}`)
      case 'fg':
        return cn(STATIC_CLS.hoverIconBase, fg('digest'), `group-hover:${fg('title')}`)
      case 'fg-red':
        return cn(
          STATIC_CLS.hoverIconBase,
          fg('digest'),
          `group-hover:${rainbow(COLOR_NAME.RED, 'fg')}`,
        )
      case 'icon-red':
        return cn(
          STATIC_CLS.hoverIconBase,
          fill('digest'),
          `group-hover:${rainbow(COLOR_NAME.RED, 'fill')}`,
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
        return cn(fill('title'))

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

      isDarkBlack,
      isBlackPrimary,
    }),
    // deps: only those that can affect returned behaviors/strings
    [
      containerClass,
      pageLightClass,
      pageDarkClass,
      isAvatarSquare,
      isLightTheme,
      primaryColor,
      isDarkBlack,
      isBlackPrimary,
    ],
  )
}
