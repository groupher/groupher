import type {
  TDashboardAliasRoute,
  TDashboardBaseInfoRoute,
  TDashboardBroadcastRoute,
  TDashboardDocRoute,
  TDashboardLayoutRoute,
  TDashboardPath,
  TDashboardSEORoute,
} from '~/spec'

export const NON_COMMUNITY_ROUTE = {
  APPLY_COMMUNITY: '/apply/community',
}

export const APPLY_COMMUNITY = '/apply/community'
export const FEEDBACK = '/home/post?for=feedback'
export const DOCS = '/home/doc'

export const DSB_ROUTE = {
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
  ANALYSIS: 'analysis',
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
  DSB_ROUTE.POST,
  DSB_ROUTE.DOC,
  DSB_ROUTE.CHANGELOG,
  DSB_ROUTE.COMMUNITIES,
]

export const DSB_BASEINFO_ROUTE = {
  BASIC: 'basic',
  SOCIAL: 'social',
  OTHER: 'other',
  LOGOS: 'logos',
} as Record<Uppercase<TDashboardBaseInfoRoute>, TDashboardBaseInfoRoute>

export const DSB_SEO_ROUTE = {
  SEARCH_ENGINE: 'search_engine',
  TWITTER: 'twitter',
} as Record<Uppercase<TDashboardSEORoute>, TDashboardSEORoute>

export const DSB_DOC_ROUTE = {
  TABLE: 'table',
  TREE: 'tree',
  COVER: 'cover',
  FAQ: 'faq',
} as Record<Uppercase<TDashboardDocRoute>, TDashboardDocRoute>

export const DSB_LAYOUT_ROUTE = {
  GENERAL: 'general',
  THEME: 'theme',
  POST: 'post',
  KANBAN: 'kanban',
  CHANGELOG: 'changelog',
  DOC: 'doc',
} as Record<Uppercase<TDashboardLayoutRoute>, TDashboardLayoutRoute>

export const DSB_BROADCAST_ROUTE = {
  GLOBAL: 'global',
  ARTICLE: 'article',
} as Record<Uppercase<TDashboardBroadcastRoute>, TDashboardBroadcastRoute>

export const DSB_ALIAS_ROUTE = {
  THREAD: 'thread',
  KANBAN: 'kanban',
  OTHERS: 'others',
} as Record<Uppercase<TDashboardAliasRoute>, TDashboardAliasRoute>

// TODO: use safe route
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
    ...DSB_ROUTE,
  },
}

export const STATIC_ROUTES = ['/', '/pricing', '/book-demo', '/oops']
