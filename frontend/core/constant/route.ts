import type { TDashboardTabsConfig } from '~/hooks/useDsbRouteTab'

export const NON_COMMUNITY_ROUTE = {
  APPLY_COMMUNITY: '/apply/community',
}

export const APPLY_COMMUNITY = '/apply/community'
export const FEEDBACK = '/home/post?for=feedback'
export const DOCS = '/home/doc'

export const DSB_ROUTE = {
  OVERVIEW: 'dashboard',
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
  'THIRD-PART': 'third-part',
  ADMINS: 'admins',
  WIDGETS: 'widgets',
  INOUT: 'inout',
} as const

export const DSB_INFO_ROUTE = {
  BASIC: 'basic',
  SOCIAL: 'social',
  OTHER: 'other',
  LOGOS: 'logos',
} as const

export const DSB_SEO_ROUTE = {
  SEARCH_ENGINE: 'search_engine',
  TWITTER: 'twitter',
} as const

export const DSB_DOC_ROUTE = {
  TABLE: 'table',
  TREE: 'tree',
  COVER: 'cover',
  FAQ: 'faq',
} as const

export const DSB_LAYOUT_ROUTE = {
  GENERAL: 'general',
  THEME: 'theme',
  POST: 'post',
  KANBAN: 'kanban',
  CHANGELOG: 'changelog',
  DOC: 'doc',
} as const

export const DSB_BROADCAST_ROUTE = {
  GLOBAL: 'global',
  ARTICLE: 'article',
} as const

export const DSB_ALIAS_ROUTE = {
  THREAD: 'thread',
  KANBAN: 'kanban',
  OTHERS: 'others',
} as const

export const DSB_THIRD_PART_ROUTE = {
  ANALYTICS: 'analytics',
  WEBHOOKS: 'webhooks',
  BOTS: 'bots',
  EMAIL: 'email',
  CONTENT_SYNC: 'content-sync',
} as const

export const DSB_WIDGET_ROUTE = {
  DRAWER: 'drawer',
  MODAL: 'modal',
  POPUP: 'popup',
  IFRAME: 'iframe',
  LINK: 'link',
} as const

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

export const DSB_TAB = {
  MAIN: 'mainTab',
  BASE_INFO: 'baseInfoTab',
  ALIAS: 'aliasTab',
  THIRD_PART: 'thirdPartTab',
  SEO: 'seoTab',
  DOC: 'docTab',
  LAYOUT: 'layoutTab',
  BROADCAST: 'broadcastTab',
} as const

export const INFO_TABS_CFG: TDashboardTabsConfig<typeof DSB_INFO_ROUTE> = {
  tab: DSB_ROUTE.INFO,
  routeEnum: DSB_INFO_ROUTE,
  baseSegment: DSB_ROUTE.INFO,
  items: [
    { title: '基本信息', slug: DSB_INFO_ROUTE.BASIC, segment: '' },
    { title: 'Logo', slug: DSB_INFO_ROUTE.LOGOS },
    { title: '社交媒体', slug: DSB_INFO_ROUTE.SOCIAL },
    { title: '其他', slug: DSB_INFO_ROUTE.OTHER },
  ],
}

export const LAYOUT_TABS_CFG: TDashboardTabsConfig<typeof DSB_LAYOUT_ROUTE> = {
  tab: DSB_ROUTE.LAYOUT,
  routeEnum: DSB_LAYOUT_ROUTE,
  baseSegment: DSB_ROUTE.LAYOUT,
  items: [
    { title: '通用', slug: DSB_LAYOUT_ROUTE.GENERAL, segment: '' },
    { title: '主题/背景', slug: DSB_LAYOUT_ROUTE.THEME },
    { title: '讨论区', slug: DSB_LAYOUT_ROUTE.POST },
    { title: '看板', slug: DSB_LAYOUT_ROUTE.KANBAN },
    { title: '更新日志', slug: DSB_LAYOUT_ROUTE.CHANGELOG },
    { title: '帮助台', slug: DSB_LAYOUT_ROUTE.DOC },
  ],
}

export const SEO_TABS_CFG: TDashboardTabsConfig<typeof DSB_SEO_ROUTE> = {
  tab: DSB_ROUTE.SEO,
  routeEnum: DSB_SEO_ROUTE,
  baseSegment: DSB_ROUTE.SEO,
  items: [
    { title: '搜索引擎', slug: DSB_SEO_ROUTE.SEARCH_ENGINE, segment: '' },
    { title: 'Twitter', slug: DSB_SEO_ROUTE.TWITTER },
  ],
}

export const THIRD_PART_TABS_CFG: TDashboardTabsConfig<typeof DSB_THIRD_PART_ROUTE> = {
  tab: DSB_ROUTE['THIRD-PART'],
  routeEnum: DSB_THIRD_PART_ROUTE,
  baseSegment: DSB_ROUTE['THIRD-PART'],
  items: [
    { title: '统计分析', slug: DSB_THIRD_PART_ROUTE.ANALYTICS, segment: '' },
    { title: 'Webhooks', slug: DSB_THIRD_PART_ROUTE.WEBHOOKS },
    { title: '消息机器人', slug: DSB_THIRD_PART_ROUTE.BOTS },
    { title: '电子邮件', slug: DSB_THIRD_PART_ROUTE.EMAIL },
    { title: '内容同步', slug: DSB_THIRD_PART_ROUTE.CONTENT_SYNC },
  ],
}

export const ALIAS_TABS_CFG: TDashboardTabsConfig<typeof DSB_ALIAS_ROUTE> = {
  tab: DSB_ROUTE.ALIAS,
  routeEnum: DSB_ALIAS_ROUTE,
  baseSegment: DSB_ROUTE.ALIAS,
  items: [
    { title: '板块入口', slug: DSB_ALIAS_ROUTE.THREAD, segment: '' },
    { title: '看板', slug: DSB_ALIAS_ROUTE.KANBAN },
    { title: '其他', slug: DSB_ALIAS_ROUTE.OTHERS },
  ],
}

export const WIDGET_TABS_CFG: TDashboardTabsConfig<typeof DSB_WIDGET_ROUTE> = {
  tab: DSB_ROUTE.WIDGETS,
  routeEnum: DSB_WIDGET_ROUTE,
  baseSegment: DSB_ROUTE.WIDGETS,
  items: [
    { title: '侧边栏', slug: DSB_WIDGET_ROUTE.DRAWER, segment: '' },
    { title: '居中模态框', slug: DSB_WIDGET_ROUTE.MODAL },
    { title: '弹出提示', slug: DSB_WIDGET_ROUTE.POPUP },
    { title: '页面内嵌', slug: DSB_WIDGET_ROUTE.IFRAME },
    { title: '链接', slug: DSB_WIDGET_ROUTE.LINK },
  ],
}
