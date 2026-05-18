import type { TDsbTabs } from '~/hooks/useDsbLayoutTabs'

const NON_COMMUNITY_ROUTE = {
  APPLY_COMMUNITY: '/apply/community',
}

export const APPLY_COMMUNITY = '/apply/community'
export const FEEDBACK = '/home/post?for=feedback'
export const DOCS = '/home/doc'

export const DSB_SEG = 'dashboard'

export const DSB_ROUTE = {
  OVERVIEW: DSB_SEG,
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
  CLASSIC: 'header',
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
  ANALYSIS: 'analysis',
  LAYOUT: 'layout',
  EDITOR: 'editor',
  TREE: 'tree',
  COVER: 'cover',
  FAQ: 'faq',
  GIT_SYNC: 'git-sync',
  DOMAIN: 'domain',
  IMPORT: 'import',
  BACKUP: 'backup',
} as const

export const DSB_POST_ROUTE = {
  ANALYSIS: 'analysis',
  LAYOUT: 'layout',
  CONTENT: 'content',
  BEHAVIOR: 'behavior',
} as const

export const DSB_CHANGELOG_ROUTE = {
  ANALYSIS: 'analysis',
  LAYOUT: 'layout',
  CONTENT: 'content',
  BEHAVIOR: 'behavior',
} as const

export const DSB_LAYOUT_ROUTE = {
  GENERAL: 'general',
  APPEARANCE: 'appearance',
  THEME: 'theme',
  WALLPAPER: 'wallpaper',
  POST: 'post',
  KANBAN: 'kanban',
  CHANGELOG: 'changelog',
  DOC: 'doc',
} as const

export const DSB_DOMAIN_ROUTE = {
  PLATFORM: 'platform',
  CUSTOM: 'custom',
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

const DSB_WIDGET_ROUTE = {
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
  MENU: 'menuTab',
  BASE_INFO: 'baseInfoTab',
  ALIAS: 'aliasTab',
  THIRD_PART: 'thirdPartTab',
  SEO: 'seoTab',
  DOC: 'docTab',
  LAYOUT: 'layoutTab',
  BROADCAST: 'broadcastTab',
  WIDGET: 'widgetTab',
} as const

export const INFO_TABS: TDsbTabs = {
  segment: DSB_ROUTE.INFO,
  items: [
    { title: 'dsb.info.basic', slug: DSB_INFO_ROUTE.BASIC, segment: '' },
    { title: 'dsb.info.logo', slug: DSB_INFO_ROUTE.LOGOS },
    { title: 'dsb.info.social', slug: DSB_INFO_ROUTE.SOCIAL },
    { title: 'common.other', slug: DSB_INFO_ROUTE.OTHER },
  ],
}

export const LAYOUT_TABS: TDsbTabs = {
  segment: DSB_ROUTE.LAYOUT,
  items: [
    { title: 'dsb.layout.general', slug: DSB_LAYOUT_ROUTE.GENERAL, segment: '' },
    { title: 'dsb.layout.appearance', slug: DSB_LAYOUT_ROUTE.APPEARANCE },
    { title: 'dsb.layout.theme', slug: DSB_LAYOUT_ROUTE.THEME },
    { title: 'dsb.layout.wallpaper', slug: DSB_LAYOUT_ROUTE.WALLPAPER },
    { title: 'dsb.layout.kanban', slug: DSB_LAYOUT_ROUTE.KANBAN },
  ],
}

export const DOMAIN_TABS: TDsbTabs = {
  segment: DSB_ROUTE.DOMAIN,
  items: [
    { title: 'dsb.domain.platform', slug: DSB_DOMAIN_ROUTE.PLATFORM, segment: '' },
    { title: 'dsb.domain.custom', slug: DSB_DOMAIN_ROUTE.CUSTOM },
  ],
}

export const BROADCAST_TABS: TDsbTabs = {
  segment: DSB_ROUTE.BROADCAST,
  items: [
    { title: 'dsb.broadcast.global', slug: DSB_BROADCAST_ROUTE.GLOBAL, segment: '' },
    { title: 'dsb.broadcast.article', slug: DSB_BROADCAST_ROUTE.ARTICLE },
  ],
}

export const SEO_TABS: TDsbTabs = {
  segment: DSB_ROUTE.SEO,
  items: [
    { title: 'dsb.seo.search_engine', slug: DSB_SEO_ROUTE.SEARCH_ENGINE, segment: '' },
    { title: 'dsb.seo.twitter', slug: DSB_SEO_ROUTE.TWITTER },
  ],
}

export const THIRD_PART_TABS: TDsbTabs = {
  segment: DSB_ROUTE['THIRD-PART'],
  items: [
    { title: 'dsb.third_part.analytics', slug: DSB_THIRD_PART_ROUTE.ANALYTICS, segment: '' },
    { title: 'dsb.third_part.webhooks', slug: DSB_THIRD_PART_ROUTE.WEBHOOKS },
    { title: 'dsb.third_part.bots', slug: DSB_THIRD_PART_ROUTE.BOTS },
    { title: 'dsb.third_part.email', slug: DSB_THIRD_PART_ROUTE.EMAIL },
    { title: 'dsb.third_part.content_sync', slug: DSB_THIRD_PART_ROUTE.CONTENT_SYNC },
  ],
}

export const ALIAS_TABS: TDsbTabs = {
  segment: DSB_ROUTE.ALIAS,
  items: [
    { title: 'dsb.alias.thread', slug: DSB_ALIAS_ROUTE.THREAD, segment: '' },
    { title: 'dsb.alias.kanban', slug: DSB_ALIAS_ROUTE.KANBAN },
    { title: 'common.other', slug: DSB_ALIAS_ROUTE.OTHERS },
  ],
}

export const DOC_TABS: TDsbTabs = {
  segment: DSB_ROUTE.DOC,
  items: [
    { title: 'dsb.doc.analysis', slug: DSB_DOC_ROUTE.ANALYSIS },
    { title: 'dsb.doc.layout', slug: DSB_DOC_ROUTE.LAYOUT },
    { title: 'dsb.doc.editor', slug: DSB_DOC_ROUTE.EDITOR },
    { title: 'dsb.doc.faq', slug: DSB_DOC_ROUTE.FAQ },
    { title: 'dsb.doc.git_sync', slug: DSB_DOC_ROUTE.GIT_SYNC },
    { title: 'dsb.doc.domain', slug: DSB_DOC_ROUTE.DOMAIN },
    { title: 'dsb.doc.import', slug: DSB_DOC_ROUTE.IMPORT },
    { title: 'dsb.doc.backup', slug: DSB_DOC_ROUTE.BACKUP },
  ],
}

export const WIDGET_TABS: TDsbTabs = {
  segment: DSB_ROUTE.WIDGETS,
  items: [
    { title: 'dsb.widget.drawer', slug: DSB_WIDGET_ROUTE.DRAWER, segment: '' },
    { title: 'dsb.widget.modal', slug: DSB_WIDGET_ROUTE.MODAL },
    { title: 'dsb.widget.popup', slug: DSB_WIDGET_ROUTE.POPUP },
    { title: 'dsb.widget.iframe', slug: DSB_WIDGET_ROUTE.IFRAME },
    { title: 'dsb.widget.link', slug: DSB_WIDGET_ROUTE.LINK },
  ],
}

export const DSB_COVERS = {
  INTEGRATIONS: 'integrations',
  WORKPLACE: 'workplace',
  CMS: 'cms',
}
