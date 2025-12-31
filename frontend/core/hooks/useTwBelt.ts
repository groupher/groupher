import { type ClassValue, clsx } from 'clsx'
import { COLOR_NAME } from '~/const/colors'
import METRIC from '~/const/metric'
import { cn } from '~/css'
import { camelize } from '~/fmt'
import useAvatarLayout from '~/hooks/useAvatarLayout'
import useDashboard from '~/hooks/useDashboard'
import useMetric from '~/hooks/useMetric'
import usePrimaryColor from '~/hooks/usePrimaryColor'
import useTheme from '~/hooks/useTheme'
import type { TColorName, TFlatThemeKey, TSpace, TZIndexType } from '~/spec'

type TColorPrefix = 'fg' | 'bg' | 'bgSoft' | 'fill' | 'border' | 'borderSoft' | 'decoration'
type TLinkColorPrefix = 'fg' | 'fill'
type TMenuPart = 'bg' | 'bar' | 'title' | 'link' | 'icon' | 'activeBox' | 'activeIcon'
type TShadowType = 'sm' | 'md' | 'lg' | 'xl' | 'card' | 'drawer' | 'modal'
type TDimLevel = 'lg' | 'md' | 'sm'
type THoverPart = 'bg' | 'icon' | 'bg-red' | 'icon-red' | 'fg' | 'fg-red'
type TCutWWidth = `w-${number}` | `w-[${number}px]`

type TRet = {
  cn: (...inputs: ClassValue[]) => string
  container: () => string
  fg: (key: TFlatThemeKey) => string
  bg: (key: TFlatThemeKey) => string
  fill: (key: TFlatThemeKey) => string
  br: (key: TFlatThemeKey) => string
  rainbow: (color: TColorName, prefix?: TColorPrefix) => string
  rainbowSoft: (color: TColorName | string) => string
  primary: (prefix?: TColorPrefix) => string
  linker: (prefix?: TLinkColorPrefix) => string
  linkable: () => string
  hoverLink: (textSize?: string) => string
  hoverLinkIcon: (size?: string) => string
  zise: (unit: number) => string
  margin: (spacing: TSpace) => string
  divider: () => string
  VDivider: () => string
  sexyBorder: (turn?: number, classNames?: string) => string
  sexyVBorder: (turn: number, classNames?: string) => string
  avatar: (level?: 'md' | 'sm' | '') => string
  gradientBar: (color: TColorName) => string
  vividDark: () => string
  dimDark: (level?: TDimLevel) => string
  menu: (part: TMenuPart) => string
  shadow: (size: TShadowType) => string
  cut: (classname?: TCutWWidth) => string
  landingTitle: () => string
  hover: (part: THoverPart) => string
  zIndex: (key: TZIndexType, visible?: boolean) => string
  page: () => string

  isDarkBlack: boolean
  isBlackPrimary: boolean
}

/**
 * NOTE: the classNames returned from here, must me declared in the tailwind.config's safelist
 * even you return static strings, cuz those are consider as dynamic, and tailwind will not know them
 */
export default (): TRet => {
  const { isLightTheme } = useTheme()
  const metric = useMetric()
  const { isSquare: isAvatarSquare } = useAvatarLayout()
  const primaryColor = usePrimaryColor()
  const { pageBg, pageBgDark } = useDashboard()

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
   * cover article.title -> article-title to match the tailwind css vars name
   */
  const _theme = (key: TFlatThemeKey, prefix: string) => `${prefix}-${key.replace(/\./g, '-')}`

  const fg = (key: TFlatThemeKey) => _theme(key, 'text')
  const bg = (key: TFlatThemeKey) => _theme(key, 'bg')
  const fill = (key: TFlatThemeKey) => _theme(key, 'fill')
  const br = (key: TFlatThemeKey) => _theme(key, 'border')

  const _rainbowAlias = (prefix: TColorPrefix): string => {
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
    const prefix$ = _rainbowAlias(prefix as TColorPrefix)
    const color$ = camelize(color)

    if (prefix === 'bgSoft') {
      if (color === COLOR_NAME.BLACK) {
        return bg('hoverBg')
      }

      return `${prefix$}-${color$}Soft`
    }

    if (prefix === 'borderSoft') {
      if (isDarkBlack && metric !== METRIC.LANDING) {
        return 'border-text-hint'
      }

      return `${prefix$}-${color$}/50`
    }

    return `${prefix$}-${color$}`
  }

  const rainbowSoft = (color: TColorName | string): string => {
    const prefix$ = 'bg-rainbow'
    const color$ = camelize(color)

    if (color === COLOR_NAME.BLACK) {
      return bg('hoverBg')
    }

    return `${prefix$}-${color$}Soft`
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
    return cn('no-underline pointer hover:underline')
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
    return cn(
      `${size}`,
      'mr-1 group-smoky-65',
      `group-hover:${fill('text.title')}`,
      fill('text.digest'),
    )
  }

  /**
   * this is not typo, cause the existing param is `size`
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

  const sexyBorder = (turn = 35, classNames?: string): string => {
    return cn('h-px w-full border-b', `sexy-border-${turn}`, classNames)
  }

  const sexyVBorder = (turn: number, classNames = ''): string => {
    return cn('h-full w-px border-l', `sexy-border-${turn}`, classNames)
  }

  const avatar = (level = 'md') => {
    if (isAvatarSquare) {
      return level === '' ? 'rounded' : `rounded-${level}`
    }

    return 'circle'
  }

  const gradientBar = (color: TColorName): string => {
    return `bg-gradient-to-r from-rainbow-${color.toLocaleLowerCase()}Bg to-transparent`
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
      case 'activeBox': {
        return cn(
          'opacity-100 scale-100',
          fg('text.title'),
          fill('text.title'),
          bg('menuHoverBg'),
          br('divider'),
          shadow('sm'),
        )
      }
      case 'activeIcon': {
        return cn(fill('text.title'))
      }
      case 'link': {
        return cn('size-3.5 opacity-0 group-hover/menubar:opacity-60', fill('text.digest'))
      }
      default: {
        return ''
      }
    }
  }

  const shadow = (metric: TShadowType): string => `shadow-${metric}`

  const cut = (classnames: TCutWWidth = 'w-12'): string => {
    const maxWidth = classnames.replace('w-', 'max-w-')
    return cn('truncate', maxWidth, 'w-fit', 'w-auto')
  }

  const landingTitle = (): string => {
    return cn(
      'text-3xl bold-sm opacity-70 dark:opacity-90',
      fg('text.title'),
      isLightTheme && 'text-shadow',
    )
  }

  const hover = (part: THoverPart): string => {
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
      case 'fg-red': {
        return cn(
          'trans-all-100 pointer',
          fg('text.digest'),
          `group-hover:${rainbow(COLOR_NAME.RED, 'fg')}`,
        )
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

  const zIndex = (type: TZIndexType, visible?: boolean): string => {
    if (visible === false) return '-z-10'

    return `z-${type}`
  }

  /**
   * page bg is confirmed by CSS rules in tailwind/common/page.css
   * cuz store/theme will cause flash since is init on client side
   */
  const page = (): string => {
    return `page-${camelize(pageBg)} page-${camelize(pageBgDark)}`
  }

  return {
    cn,
    container,
    fg,
    bg,
    fill,
    br,
    rainbow,
    rainbowSoft,
    primary,
    linker,
    linkable,
    hoverLink,
    hoverLinkIcon,
    zise,
    margin,
    divider,
    VDivider,
    sexyBorder,
    sexyVBorder,
    avatar,
    gradientBar,
    vividDark,
    menu,
    shadow,
    cut,
    isDarkBlack,
    isBlackPrimary,
    landingTitle,
    dimDark,
    hover,
    zIndex,
    page,
  }
}
