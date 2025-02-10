export type TDashboardBaseInfoRoute = 'basic' | 'social' | 'logos' | 'other'
export type TDashboardSEORoute = 'search_engine' | 'twitter'
export type TDashboardDocRoute = 'table' | 'tree' | 'cover' | 'faq'
export type TDashboardLayoutRoute = 'general' | 'theme' | 'post' | 'kanban' | 'changelog' | 'doc'
export type TDashboardBroadcastRoute = 'global' | 'article'
export type TDashboardAliasRoute = 'thread' | 'kanban' | 'others'

export type TDashboardPath =
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
  // analysis
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
  | 'third_part'
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
      DASHBOARD: TDashboardPath
    }
