export type * from './account'
export type * from './article'
export type * from './color'
export type * from './community'
export type * from './dashboard'
export type * from './emotion'
export type * from './gallery'
export type * from './graphql'
export type * from './i18n'
export type * from './menu'
export type * from './metric'
export type * from './node_style'
export type * from './oauth'
export type * from './route'
export type * from './size'
export type * from './store'
export type * from './tantable'
export type * from './theme'
export type * from './thread'
export type * from './utils'
export type * from './wallpaper'

import type { TTransKey } from './i18n'
import type { TThemeName } from './theme'

export type TContainer = 'body' | 'drawer'

export type TGlowPosition = 'fixed' | 'absolute'
export type TGlowEffect = {
  glowType: string
  glowPosition?: TGlowPosition
  glowFixed?: boolean
  glowOpacity?: string
  $theme?: TThemeName

  changeGlowEffect?: (effect: string) => void
}

interface IWindow extends Window {
  appVersion?: string
  /**
   * used for check platform hook
   */
  chrome?: unknown
  safari?: unknown
  StyleMedia?: unknown
  HTMLElement?: typeof HTMLElement

  // for baidu analysis
  _hmt?: Array<unknown>
}

export type TWindow = IWindow | null

export type TConstValues<T extends Record<PropertyKey, string>> = T[keyof T]

export type TCrumbConfig = {
  title: TTransKey
  seg: string
  toSeg: string
  children: { title: TTransKey; seg: string }[]
}
