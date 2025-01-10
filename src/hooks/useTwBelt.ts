import { clsx, type ClassValue } from 'clsx'

import { cn } from '~/css'
import type { TColorName, TSpace } from '~/spec'
import { COLOR_NAME } from '~/const/colors'
import type { TFlatThemeKey } from '~/utils/themes/skins'

import { container as containerConf, borderSoft as borderSoftConf } from '~/const/twConfig.json'
import { camelize } from '~/fmt'

import METRIC from '~/const/metric'
import useTheme from '~/hooks/useTheme'
import useMetric from '~/hooks/useMetric'
import useAvatarLayout from '~/hooks/useAvatarLayout'
import usePrimaryColor from '~/hooks/usePrimaryColor'

type TColorPrefix = 'fg' | 'bg' | 'bgSoft' | 'fill' | 'border' | 'borderSoft' | 'decoration'
type TLinkColorPrefix = 'fg' | 'fill'
type TBreakOut = 'footer' | 'header'
type TMenuPart = 'bg' | 'bar' | 'title' | 'link' | 'icon'
type TShadowSize = 'sm' | 'md' | 'lg' | 'xl' | 'drawer'
type TThemeSwitch = 'auto' | 'dark' | 'light'
type TDimLevel = 'lg' | 'md' | 'sm'
type THoverPart = 'bg' | 'icon' | 'bg-red' | 'icon-red' | 'fg'
type TCutWWidth = `w-${number}` | `w-[${number}px]`

type TRet = {
  cn: (...inputs: ClassValue[]) => string
  container: () => string
  global: (className: string) => string
  fg: (key: TFlatThemeKey, switchBy?: TThemeSwitch) => string
  bg: (key: TFlatThemeKey, switchBy?: TThemeSwitch) => string
  fill: (key: TFlatThemeKey, switchBy?: TThemeSwitch) => string
  br: (key: TFlatThemeKey) => string
  rainbow: (color: TColorName, prefix?: TColorPrefix) => string
  rainbowSoft: (color: TColorName | string) => string
  rainbowPale: (color: TColorName | string) => string
  primary: (prefix?: TColorPrefix) => string
  linker: (prefix?: TLinkColorPrefix) => string
  linkable: () => string
  hoverLink: (textSize?: string) => string
  hoverLinkIcon: (size?: string) => string
  zise: (unit: number) => string
  margin: (spacing: TSpace) => string
  divider: () => string
  VDivider: () => string
  sexyHBorder: (turn?: number) => string
  sexyVBorder: (turn: number, classNames?: string) => string
  avatar: (level?: 'md' | 'sm' | '') => string
  gradiientBar: (color: TColorName) => string
  breakOut: (type?: TBreakOut) => string
  vividDark: () => string
  dimDark: (level?: TDimLevel) => string
  menu: (part: TMenuPart) => string
  shadow: (size: TShadowSize) => string
  cutRest: (classname?: TCutWWidth) => string
  landingTitle: () => string
  hoverable: (part: THoverPart) => string

  isDarkBlack: boolean
  isBlackPrimary: boolean
}

/**
 * NOTE: the classNams returned from here, must me declared in the tailwind.config's safelist
 * even you return static strings, cauze those are consided as dynamic, and tailwind will not know them
 */
export default (): TRet => {
  const { isLightTheme } = useTheme()
  const metric = useMetric()
  const { isSquare: isAvatarSquare } = useAvatarLayout()

  const primaryColor = usePrimaryColor()

  const container = () => {
    return `container-${metric.toLowerCase()}`
  }

  /**
   * black color (default primary color) in dark theme should be treat different
   * need spec color for it according the situation
   */
  const isDarkBlack = !isLightTheme && primaryColor === COLOR_NAME.BLACK
  const isBlackPrimary = primaryColor === COLOR_NAME.BLACK

  /**
   * cover article.title -> article-title to match the tailwind csss varaible name
   */
  const _theme = (key: TFlatThemeKey, prefix: string, switchBy?: TThemeSwitch) => {
    if (switchBy === 'dark') return `${prefix}-${key.replace(/\./g, '-')}-dark`
    if (switchBy === 'light') return `${prefix}-${key.replace(/\./g, '-')}`

    return isLightTheme
      ? `${prefix}-${key.replace(/\./g, '-')}`
      : `${prefix}-${key.replace(/\./g, '-')}-dark`
  }

  const global = (className: string) => (isLightTheme ? className : `${className}-dark`)
  const fg = (key: TFlatThemeKey, switchBy: TThemeSwitch = 'auto') => {
    return _theme(key, 'text', switchBy)
  }
  const bg = (key: TFlatThemeKey, switchBy: TThemeSwitch = 'auto') => {
    return _theme(key, 'bg', switchBy)
  }
  const fill = (key: TFlatThemeKey, switchBy: TThemeSwitch = 'auto') => {
    return _theme(key, 'fill', switchBy)
  }
  const br = (key: TFlatThemeKey) => _theme(key, 'border')

  const _rainbowalias = (prefix: TColorPrefix): string => {
    switch (prefix) {
      case 'fg': {
        return 'text-rainbow'
      }

      case 'bgSoft': {
        return 'bg-rainbow'
      }

      case 'borderSoft': {
        return 'border-rainbow'
      }

      default: {
        return `${prefix}-rainbow`
      }
    }
  }

  /**
   * use in theme balls and all kinks of gradients
   */
  const rainbow = (color: TColorName, prefix = 'fg'): string => {
    const prefix$ = _rainbowalias(prefix as TColorPrefix)
    const color$ = camelize(color)

    if (prefix === 'bgSoft') {
      if (color === COLOR_NAME.BLACK) {
        return bg('hoverBg')
      }

      return isLightTheme ? `${prefix$}-${color$}Soft` : `${prefix$}-${color$}Soft-dark`
    }

    if (prefix === 'borderSoft') {
      const opacity = isLightTheme ? borderSoftConf.opacity : borderSoftConf.opacity_dark

      if (isDarkBlack && metric !== METRIC.HOME) {
        return 'border-text-hint-dark'
      }

      return isLightTheme
        ? `${prefix$}-${color$}/${opacity}`
        : `${prefix$}-${color$}-dark/${opacity}`
    }

    return isLightTheme ? `${prefix$}-${color$}` : `${prefix$}-${color$}-dark`
  }

  const rainbowSoft = (color: TColorName | string): string => {
    const prefix$ = 'bg-rainbow'
    const color$ = camelize(color)

    if (color === COLOR_NAME.BLACK) {
      return bg('hoverBg')
    }

    return isLightTheme ? `${prefix$}-${color$}Soft` : `${prefix$}-${color$}Soft-dark`
  }

  const rainbowPale = (color: TColorName | string): string => {
    const prefix$ = 'bg-rainbow'
    const color$ = camelize(color)

    if (color === COLOR_NAME.BLACK) {
      return bg('hoverBg')
    }

    return isLightTheme ? `${prefix$}-${color$}Pale` : `${prefix$}-${color$}Pale-dark`
  }

  /**
   * use primary color for text/background/border color
   * primary color is set in dashboard
   */
  const primary = (prefix = 'fg'): string => rainbow(primaryColor, prefix)

  const linker = (prefix = 'fg'): string => {
    if (primaryColor === COLOR_NAME.BLACK) {
      if (prefix === 'fg') return fg('text.link')

      return fill('text.link')
    }

    return rainbow(primaryColor, prefix)
  }

  const linkable = () => {
    return 'no-underline pointer hover:underline'
  }

  const hoverLink = (textSize = 'text-base') => {
    return cn(
      'row-center group',
      `${textSize}`,
      'px-1.5 py-0.5 rounded trans-all-100',
      `hover:${bg('hoverBg')}`,
      `hover:${fg('text.title')}`,
      'underline-offset-8 hover:underline',
      'decoration-1',
      primary('decoration'),
      fg('text.digest'),
    )
  }

  const hoverLinkIcon = (size = 'size-3.5') => {
    return cn(`${size}`, 'mr-1', `group-hover:${fill('text.title')}`, fill('text.digest'))
  }

  /**
   * this is not typo, cause the exsiting prama is `size`
   */
  const zise = (unit: number): string => clsx(`size-${unit}`)

  const margin = (spacing: TSpace): string => {
    const dir = { top: 'mt', bottom: 'mb', left: 'ml', right: 'mr' }

    return Object.entries(spacing)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => {
        if (value !== 'px' && value < 0) {
          return `-${dir[key]}-${Math.abs(value)}`
        }

        return `${dir[key]}-${value}`
      })
      .join(' ')
  }

  const divider = (): string => {
    return cn('w-full h-px', bg('divider'))
  }

  const VDivider = (): string => {
    return cn('w-px h-3 ml-1.5 mr-1.5', bg('text.digest'))
  }

  const sexyHBorder = (turn = 35): string => {
    return cn('h-px w-full border-b', global(`sexy-border-${turn}`))
  }

  const sexyVBorder = (turn: number, classNames = ''): string => {
    return cn('h-full w-px border-l', global(`sexy-border-${turn}`), classNames)
  }

  const avatar = (level = 'md') => {
    if (isAvatarSquare) {
      return level === '' ? 'rounded' : `rounded-${level}`
    }

    return 'circle'
  }

  const gradiientBar = (color: TColorName): string => {
    return `bg-gradient-to-r from-rainbow-${color.toLocaleLowerCase()}Bg to-transparent`
  }

  const breakOut = (type: TBreakOut = 'footer') => {
    const curMetric = metric || METRIC.COMMUNITY

    const unit = containerConf[curMetric.toLowerCase()]

    if (type === 'footer') {
      return cn(
        'w-full',
        `w-[${unit.width}]`,
        `-ml-${unit.pl}`,
        `mr-${unit.pr}`,
        `pl-${unit.pl}`,
        `pr-${unit.pr}`,
        global('footer-inner-shadow'),
      )
    }

    return 'w-full'
  }

  const vividDark = (): string => {
    if (!isLightTheme) return 'saturate-150 brightness-125'

    return ''
  }

  const dimDark = (level: TDimLevel = 'md'): string => {
    if (isLightTheme) return ''

    if (level === 'sm') return 'brightness-90'
    if (level === 'lg') return 'brightness-50'

    return 'brightness-75'
  }

  const menu = (part: TMenuPart): string => {
    switch (part) {
      case 'bg': {
        return _theme('popover.bg', 'bg')
      }
      case 'bar': {
        return cn(
          'group/menubar row-center text-sm w-full border border-transparent rounded-md pointer',
          'px-1.5 py-1 cursor-pointer bold-none',
          'trans-all-100',
          'hover:bold-none',
          `hover:${fg('text.title')}`,
          `hover:${bg('menuHoverBg')}`,
          `hover:${br('divider')}`,
          fg('text.digest'),
        )
      }
      case 'title': {
        return cn('text-sm grow', `group-hover/menubar:${fg('text.title')}`)
      }
      case 'icon': {
        return cn('size-3 mr-2.5', fill('text.digest'), `group-hover/menubar:${fill('text.title')}`)
      }
      case 'link': {
        return cn('size-3.5 opacity-0 group-hover/menubar:opacity-60', fill('text.digest'))
      }
      default: {
        return ''
      }
    }
  }

  const shadow = (size: TShadowSize): string => {
    return global(`shadow-${size}`)
  }

  const cutRest = (classnames: TCutWWidth = 'w-12'): string => {
    const maxWidth = classnames.replace('w-', 'max-w-')
    return cn('truncate', maxWidth, 'w-fit', 'w-auto')
  }

  const landingTitle = (): string => {
    return cn(
      'text-3xl bold-sm opacity-70',
      fg('text.title'),
      isLightTheme && global('text-shadow'),
    )
  }

  const hoverable = (part: THoverPart): string => {
    switch (part) {
      case 'bg': {
        return cn('group align-both rounded trans-all-100 pointer', `hover:${bg('hoverBg')}`)
      }
      case 'bg-red': {
        return cn(
          'group align-both rounded trans-all-100 pointer',
          `hover:${rainbowSoft(COLOR_NAME.RED)}`,
        )
      }
      case 'icon': {
        return cn('trans-all-100', fill('text.digest'), `group-hover:${fill('text.title')}`)
      }
      case 'fg': {
        return cn('trans-all-100 pointer', fg('text.digest'), `group-hover:${fg('text.title')}`)
      }
      case 'icon-red': {
        return cn(
          'trans-all-100',
          fill('text.digest'),
          `group-hover:${rainbow(COLOR_NAME.RED, 'fill')}`,
        )
      }
      default: {
        return 'debug'
      }
    }
  }

  return {
    cn,
    global,
    container,
    fg,
    bg,
    fill,
    br,
    rainbow,
    rainbowSoft,
    rainbowPale,
    primary,
    linker,
    linkable,
    hoverLink,
    hoverLinkIcon,
    zise,
    margin,
    divider,
    VDivider,
    sexyHBorder,
    sexyVBorder,
    avatar,
    gradiientBar,
    breakOut,
    vividDark,
    menu,
    shadow,
    cutRest,
    isDarkBlack,
    isBlackPrimary,
    landingTitle,
    dimDark,
    hoverable,
  }
}
