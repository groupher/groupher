import type { DSB_THIRD_PART_ROUTE } from '~/const/route'

export type TDsbBaseInfoRoute = 'basic' | 'social' | 'logos' | 'other'
export type TDsbSEORoute = 'search_engine' | 'twitter'
export type TDsbDocRoute = 'table' | 'tree' | 'cover' | 'faq'
export type TDsbLayoutRoute = 'general' | 'theme' | 'post' | 'kanban' | 'changelog' | 'doc'
export type TDsbBroadcastRoute = 'global' | 'article'
export type TDsbAliasRoute = 'thread' | 'kanban' | 'others'
export type TDsbThirdPartRoute = (typeof DSB_THIRD_PART_ROUTE)[keyof typeof DSB_THIRD_PART_ROUTE]

export type TDsbPath =
  | 'overview'
  | 'dashboard'
  // basic-info
  | 'info'
  | 'seo'
  | 'ui'
  | 'layout'
  | 'threads'
  | 'alias'
  | 'domain'
  | 'analysis'
  | 'trend'
  | 'log'
  | 'domain'
  // --
  // contents
  | 'tags'
  | 'post'
  | 'changelog'
  | 'doc'
  | 'communities'
  | 'header'
  | 'footer'
  | 'broadcast'
  | 'blackhouse'
  | 'rss'
  // integrates
  | 'third-part'
  | 'admins'
  | 'widgets'
  | 'inout'

export type TPath =
  | 'home'
  | 'post'
  | 'help'
  | 'changelog'
  | 'kanban'
  | 'about'
  | 'user'
  | {
      DASHBOARD: TDsbPath
    }
