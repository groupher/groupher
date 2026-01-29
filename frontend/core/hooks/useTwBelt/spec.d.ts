// useTwBelt/spec.d.ts

import type { ClassValue } from 'clsx'
import type { TColorName, TSpace, TZIndexType } from '~/spec'

export type TColorPrefix = 'fg' | 'bg' | 'bgSoft' | 'fill' | 'border' | 'borderSoft' | 'decoration'
export type TLinkColorPrefix = 'fg' | 'fill'
export type TMenuPart = 'bg' | 'bar' | 'title' | 'link' | 'icon' | 'activeBox' | 'activeIcon'
export type TShadowType = 'sm' | 'md' | 'lg' | 'xl' | 'card' | 'drawer' | 'modal'
export type TDimLevel = 'lg' | 'md' | 'sm'
export type THoverPart = 'bg' | 'icon' | 'bg-red' | 'icon-red' | 'fg' | 'fg-red'
export type TCutWWidth = `w-${number}` | `w-[${number}px]`

/**
 * Channel keys:
 * - 不再出现 "text.xxx" 这种前缀重复
 * - scope 用点号表达：modal.mask / popover.bg / table.border
 */
export type TTextKey = 'title' | 'digest' | 'hint' | 'link' | 'black'

export type TBgKey =
  | 'divider'
  | 'hoverBg'
  | 'dot'
  | 'card'
  | 'cardAlpha'
  | 'sandBox'
  | 'alphaBg'
  | 'alphaBg2'
  | 'menuHoverBg'
  | 'menuInvertBg'
  | 'popover.bg'
  | 'modal.bg'
  | 'modal.mask'
  | 'drawer.mask'
  | 'table.border'
  | 'pageBg'
  | 'transparent'
  | 'snackBar'
  | 'link'

export type TBorderKey = 'divider' | 'table.border' | 'digest' | 'title'

export type TFillKey = 'title' | 'digest' | 'link' | 'highlight'

export type TRet = {
  cn: (...inputs: ClassValue[]) => string
  cnMerge: (...inputs: ClassValue[]) => string
  container: () => string

  fg: (key: TTextKey | `${string}.${string}`) => string
  bg: (key: TBgKey | `${string}.${string}`) => string
  fill: (key: TFillKey | `${string}.${string}`) => string
  br: (key: TBorderKey | `${string}.${string}`) => string

  hoverBr: () => string

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
}
