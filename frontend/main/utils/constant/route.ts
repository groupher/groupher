import type {
  TDashboardPath,
  TDashboardLayoutRoute,
  TDashboardBroadcastRoute,
  TDashboardAliasRoute,
  TDashboardBaseInfoRoute,
  TDashboardSEORoute,
  TDashboardDocRoute,
} from '~/spec'

export const NON_COMMUNITY_ROUTE = {
  APPLY_COMMUNITY: '/apply/community',
}

export const DASHBOARD_ROUTE = {
  OVERVIEW: 'dashboard',
  DASHBOARD: 'dashboard',
  // basic-info
  INFO: 'info',
  SEO: 'seo',
  LAYOUT: 'layout',
  THREADS: 'threads',
  ALIAS: 'alias',
  DOMAIN: 'domain',
  // analysis
  TREND: 'trend',
  LOG: 'log',
  // --
  // contents
  TAGS: 'tags',
  POST: 'post',
  CHANGELOG: 'changelog',
  DOC: 'doc',
  COMMUNITIES: 'communities',
  HEADER: 'header',
  FOOTER: 'footer',
  BROADCAST: 'broadcast',
  BLACKHOUSE: 'blackhouse',
  RSS: 'rss',
  // integrates
  THIRD_PART: 'third_part',
  ADMINS: 'admins',
  WIDGETS: 'widgets',
  INOUT: 'inout',
} as Record<Uppercase<TDashboardPath>, TDashboardPath>

export const DASHBORD_CMS_ROUTES = [
  DASHBOARD_ROUTE.POST,
  DASHBOARD_ROUTE.DOC,
  DASHBOARD_ROUTE.CHANGELOG,
  DASHBOARD_ROUTE.COMMUNITIES,
]

export const DASHBOARD_BASEINFO_ROUTE = {
  BASIC: 'basic',
  SOCIAL: 'social',
  OTHER: 'other',
  LOGOS: 'logos',
} as Record<Uppercase<TDashboardBaseInfoRoute>, TDashboardBaseInfoRoute>

export const DASHBOARD_SEO_ROUTE = {
  SEARCH_ENGINE: 'search_engine',
  TWITTER: 'twitter',
} as Record<Uppercase<TDashboardSEORoute>, TDashboardSEORoute>

export const DASHBOARD_DOC_ROUTE = {
  TABLE: 'table',
  TREE: 'tree',
  COVER: 'cover',
  FAQ: 'faq',
} as Record<Uppercase<TDashboardDocRoute>, TDashboardDocRoute>

export const DASHBOARD_LAYOUT_ROUTE = {
  GENERAL: 'general',
  THEME: 'theme',
  POST: 'post',
  KANBAN: 'kanban',
  CHANGELOG: 'changelog',
  DOC: 'doc',
} as Record<Uppercase<TDashboardLayoutRoute>, TDashboardLayoutRoute>

export const DASHBOARD_BROADCAST_ROUTE = {
  GLOBAL: 'global',
  ARTICLE: 'article',
} as Record<Uppercase<TDashboardBroadcastRoute>, TDashboardBroadcastRoute>

export const DASHBOARD_ALIAS_ROUTE = {
  THREAD: 'thread',
  KANBAN: 'kanban',
  OTHERS: 'others',
} as Record<Uppercase<TDashboardAliasRoute>, TDashboardAliasRoute>

export const ROUTE = {
  BOOK_DEMO: 'book-demo',
  // NOTE: the lower-case is MUST
  HOME: 'home',

  POST: 'post',
  HELP: 'help',
  CHANGELOG: 'changelog',
  KANBAN: 'kanban',
  ABOUT: 'about',
  USER: 'user',
  PRICE: 'pricing',

  OOPS: 'oops',

  ...NON_COMMUNITY_ROUTE,

  DASHBOARD: {
    ...DASHBOARD_ROUTE,
  },
}

export const STATIC_ROUTES = ['/', '/pricing', '/book-demo', '/oops']
