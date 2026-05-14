import { ONE_LINK_GROUP, TW_CARD } from '~/const/dashboard'
import { DSB_ALIAS_ROUTE, DSB_ROUTE } from '~/const/route'
import type { TDsbFieldMap, TDsbStoreFieldKey } from '~/stores/dashboard/spec'

import type { TDsbMenu } from './spec'

export { SEO_KEYS } from '~/const/seo'

export const DSB_DEMO_KEY = 'DSB_DEMO'

// do not change, it's map to GQ endpoint updateDashboardLayout
export const LAYOUT_FIELD = {
  PAGE_BG: 'pageBg',
  PAGE_BG_DARK: 'pageBgDark',
  PAGE_CUSTOM_BG: 'pageCustomBg',
  PAGE_CUSTOM_BG_DARK: 'pageCustomBgDark',
  PAGE_CUSTOM_INTENSITY: 'pageCustomIntensity',
  PAGE_CUSTOM_INTENSITY_DARK: 'pageCustomIntensityDark',
  PRIMARY_COLOR: 'primaryColor',
  PRIMARY_CUSTOM_COLOR: 'primaryCustomColor',
  PRIMARY_CUSTOM_COLOR_DARK: 'primaryCustomColorDark',
  SUB_PRIMARY_COLOR: 'subPrimaryColor',
  SUB_PRIMARY_CUSTOM_COLOR: 'subPrimaryCustomColor',
  SUB_PRIMARY_CUSTOM_COLOR_DARK: 'subPrimaryCustomColorDark',
  POST_LAYOUT: 'postLayout',
  KANBAN_LAYOUT: 'kanbanLayout',
  KANBAN_CARD_LAYOUT: 'kanbanCardLayout',
  KANBAN_BOARDS: 'kanbanBoards',
  KANBAN_BG_COLORS: 'kanbanBgColors',
  DOC_COVER_LAYOUT: 'docCoverLayout',
  DOC_FAQ_LAYOUT: 'docFaqLayout',
  BRAND_LAYOUT: 'brandLayout',
  TAG_LAYOUT: 'tagLayout',
  INLINE_TAG_LAYOUT: 'inlineTagLayout',
  AVATAR_LAYOUT: 'avatarLayout',
  COMMUNITY_LAYOUT: 'communityLayout',
  NAV_ACTIVE_LAYOUT: 'navActiveLayout',
  HEADER_LAYOUT: 'headerLayout',
  FOOTER_LAYOUT: 'footerLayout',
  TOPBAR_ENABLED: 'topbarEnabled',
  TOPBAR_BG: 'topbarBg',
  BROADCAST_LAYOUT: 'broadcastLayout',
  BROADCAST_ARTICLE_LAYOUT: 'broadcastArticleLayout',
  BROADCAST_BG: 'broadcastBg',
  BROADCAST_ARTICLE_BG: 'broadcastArticleBg',
  CHANGELOG_LAYOUT: 'changelogLayout',
  GLOW_TYPE: 'glowType',
  GLOW_FIXED: 'glowFixed',
  GLOW_OPACITY: 'glowOpacity',
  OVERLAY_DARK: 'overlayDark',
  GAUSS_BLUR: 'gaussBlur',
  GAUSS_BLUR_DARK: 'gaussBlurDark',
} as const

export const FIELD = {
  ...LAYOUT_FIELD,
  ENABLE: 'enable',
  BASE_INFO: 'baseInfo',
  CITY: 'city',
  TECHSTACK: 'techstack',
  MEDIA_REPORTS: 'mediaReports',
  SEO: 'seo',
  SOCIAL_LINKS: 'socialLinks',
  HEADER_LINKS: 'headerLinks',
  FOOTER_LINKS: 'footerLinks',
  FOOTER_ONELINE_LINKS: 'footerOnelineLinks',
  TAGS: 'tagGroups',
  TAG: 'tag',
  TAG_INDEX: 'tagIndex',
  FAQ_SECTIONS: 'faqSections',
  FAQ_SECTION_ITEM: 'faqSectionItem',
  FAQ_SECTION_ADD: 'faqSectionAdd',
  FAQ_SECTION_DELETE: 'faqSectionDelete',
  NAME_ALIAS: 'nameAlias',
  RSS_FEED_TYPE: 'rssFeedType',
  RSS_FEED_COUNT: 'rssFeedCount',
  WIDGETS_PRIMARY_COLOR: 'widgetsPrimaryColor',
  WIDGETS_SIZE: 'widgetsSize',
  WIDGETS_THREADS: 'widgetsThreads',
  GLOW_TYPE: 'glowType',
  GLOW_FIXED: 'glowFixed',
  GLOW_OPACITY: 'glowOpacity',
  PAGE_BG: LAYOUT_FIELD.PAGE_BG,
  PAGE_BG_DARK: LAYOUT_FIELD.PAGE_BG_DARK,
  PAGE_CUSTOM_BG: LAYOUT_FIELD.PAGE_CUSTOM_BG,
  PAGE_CUSTOM_BG_DARK: LAYOUT_FIELD.PAGE_CUSTOM_BG_DARK,
  PAGE_CUSTOM_INTENSITY: LAYOUT_FIELD.PAGE_CUSTOM_INTENSITY,
  PAGE_CUSTOM_INTENSITY_DARK: LAYOUT_FIELD.PAGE_CUSTOM_INTENSITY_DARK,
  BROADCAST_ENABLE: 'broadcastEnable',
} as const

export const TAG_STORE_FIELDS: readonly TDsbStoreFieldKey[] = [FIELD.TAGS]
export const FAQ_STORE_FIELDS: readonly TDsbStoreFieldKey[] = [FIELD.FAQ_SECTIONS]
export const PAGE_BG_STORE_FIELDS: readonly TDsbStoreFieldKey[] = [
  FIELD.PAGE_BG,
  FIELD.PAGE_CUSTOM_BG,
  FIELD.PAGE_CUSTOM_INTENSITY,
  FIELD.PAGE_BG_DARK,
  FIELD.PAGE_CUSTOM_BG_DARK,
  FIELD.PAGE_CUSTOM_INTENSITY_DARK,
]
export const PRIMARY_COLOR_STORE_FIELDS: readonly TDsbStoreFieldKey[] = [
  FIELD.PRIMARY_COLOR,
  FIELD.PRIMARY_CUSTOM_COLOR,
  FIELD.PRIMARY_CUSTOM_COLOR_DARK,
]
export const SUB_PRIMARY_COLOR_STORE_FIELDS: readonly TDsbStoreFieldKey[] = [
  FIELD.SUB_PRIMARY_COLOR,
  FIELD.SUB_PRIMARY_CUSTOM_COLOR,
  FIELD.SUB_PRIMARY_CUSTOM_COLOR_DARK,
]

export const MENU: TDsbMenu = {
  BASIC: {
    title: 'dsb.menu.basic',
    icon: 'basic',
    initFold: false,
    children: [
      {
        title: 'dsb.menu.overview',
        slug: DSB_ROUTE.OVERVIEW,
      },
      {
        title: 'dsb.menu.basic_info',
        slug: DSB_ROUTE.INFO,
      },
      {
        title: 'dsb.menu.seo',
        slug: DSB_ROUTE.SEO,
      },
      {
        title: 'dsb.menu.threads',
        slug: DSB_ROUTE.THREADS,
      },
      {
        title: 'dsb.menu.layout',
        slug: DSB_ROUTE.LAYOUT,
      },
      {
        title: 'dsb.menu.alias',
        slug: DSB_ROUTE.ALIAS,
        alias: FIELD.NAME_ALIAS,
      },
      {
        title: 'dsb.menu.admins',
        slug: DSB_ROUTE.ADMINS,
      },
      {
        title: 'dsb.menu.header',
        slug: DSB_ROUTE.CLASSIC,
      },
      {
        title: 'dsb.menu.footer',
        slug: DSB_ROUTE.FOOTER,
      },
    ],
  },

  CMS: {
    title: 'dsb.menu.cms',
    icon: 'cms',
    initFold: false,
    children: [
      {
        title: 'dsb.menu.communities',
        slug: DSB_ROUTE.COMMUNITIES,
      },
      {
        title: 'dsb.menu.tags',
        slug: DSB_ROUTE.TAGS,
      },
      {
        title: 'dsb.menu.post',
        slug: DSB_ROUTE.POST,
      },
      {
        title: 'dsb.menu.changelog',
        slug: DSB_ROUTE.CHANGELOG,
      },
      {
        title: 'dsb.menu.doc',
        slug: DSB_ROUTE.DOC,
      },
      {
        title: 'dsb.menu.broadcast',
        slug: DSB_ROUTE.BROADCAST,
      },
      {
        title: 'dsb.menu.blackhouse',
        slug: DSB_ROUTE.BLACKHOUSE,
      },
      {
        title: 'dsb.menu.rss',
        slug: DSB_ROUTE.RSS,
      },
      {
        title: 'dsb.menu.inout',
        slug: DSB_ROUTE.INOUT,
      },
    ],
  },

  ANALYSIS: {
    title: 'dsb.menu.analysis',
    icon: 'analysis',
    initFold: true,
    children: [
      {
        title: 'dsb.menu.trend',
        slug: DSB_ROUTE.TREND,
      },
      {
        title: 'dsb.menu.log',
        slug: DSB_ROUTE.LOG,
      },
    ],
  },

  INTEGRATE: {
    title: 'dsb.menu.integrations',
    icon: 'bind',
    initFold: false,
    children: [
      {
        title: 'dsb.menu.domain',
        slug: DSB_ROUTE.DOMAIN,
      },
      {
        title: 'dsb.menu.third_part',
        slug: DSB_ROUTE['THIRD-PART'],
      },
      {
        title: 'dsb.menu.widgets',
        slug: DSB_ROUTE.WIDGETS,
      },
    ],
  },
}

export const ALIAS_GROUP = {
  THREAD: DSB_ALIAS_ROUTE.THREAD,
  KANBAN: DSB_ALIAS_ROUTE.KANBAN,
  OTHERS: DSB_ALIAS_ROUTE.OTHERS,
}

export const BUILD_IN_ALIAS_SUGGESTIONS = {
  post: ['帖子', '讨论区', '论坛'],
  kanban: ['路线图', '规划', '蓝图'],
  changelog: ['新功能', '发布日志', '里程碑', '开发计划'],
  upvote: ['支持', '顶', '赞', '有帮助'],
  doc: ['文档', '帮助中心'],
  upvote_bug: ['同样问题', '复现', '求解决'],
  backlog: ['Backlog', '需求池', '待排期'],
  todo: ['Todo', '已排期', '评估中', '计划中'],
  wip: ['Wip', '完善中'],
  done: ['Done', '已解决'],
  rejected: ['Rejected', '已拒绝', '已关闭'],
  // category
  idea: ['想法', '功能建议', '功能需求', '新功能'],
  qa: ['问答', '求助 / 疑问', '使用帮助'],
  bug: ['问题上报', '缺陷', 'issue', 'bug'],
  discussion: ['讨论', '其他讨论', '其他话题'],
}

export const TW_CARD_OPTIONS = [
  {
    label: TW_CARD.SUMMARY,
    value: TW_CARD.SUMMARY,
  },

  {
    label: TW_CARD.SUMMARY_LARGE_IMAGE,
    value: TW_CARD.SUMMARY_LARGE_IMAGE,
  },
]

export const EMPTY_LINK_ITEM = {
  title: '',
  link: '',
  index: 0,
  group: ONE_LINK_GROUP,
  groupIndex: 0,
}

export const EMPTY_MEDIA_REPORT = {
  index: 0,
  title: '',
  favicon: '',
  siteName: '',
  url: '',
  editUrl: '',
}

export const BASEINFO_BASIC_KEYS: (keyof TDsbFieldMap)[] = [
  'locale',
  'title',
  'desc',
  'introduction',
  'homepage',
  'slug',
]
export const BASEINFO_LOGOS_KEYS: (keyof TDsbFieldMap)[] = ['logo', 'favicon']
export const BASEINFO_OTHER_KEYS: (keyof TDsbFieldMap)[] = [FIELD.CITY, FIELD.TECHSTACK]

export const BASEINFO_KEYS: (keyof TDsbFieldMap)[] = [
  ...BASEINFO_BASIC_KEYS,
  ...BASEINFO_LOGOS_KEYS,
  ...BASEINFO_OTHER_KEYS,
]

// export const BROADCAST_KEYS = [
//   'broadcastTab',
//   'broadcastLayout',
//   'broadcastBg',
//   'broadcastEnable',
//   'broadcastArticleLayout',
//   'broadcastArticleBg',
//   'broadcastArticleEnable',
// ]

export const DEFAULT_NEW_FAQ = {
  title: '',
  body: '',
  index: 0,
}
