import { COLOR_NAME } from '~/const/colors'
import { ONE_LINK_GROUP, TW_CARD } from '~/const/dashboard'
import { DSB_ALIAS_ROUTE, DSB_DOC_ROUTE, DSB_ROUTE } from '~/const/route'
import type { TDsbFieldMap } from '~/stores/dashboard/spec'

export { SEO_KEYS, SEO_OG_KEYS, SEO_TW_KEYS } from '~/const/seo'

export const DSB_DEMO_KEY = 'DSB_DEMO'
export const ALIGN_HEADER_OFFSET = '100px'

// do not change, it's map to GQ endpoint updateDashboardLayout
export const LAYOUT_FIELD = {
  PRIMARY_COLOR: 'primaryColor',
  POST_LAYOUT: 'postLayout',
  KANBAN_LAYOUT: 'kanbanLayout',
  KANBAN_CARD_LAYOUT: 'kanbanCardLayout',
  KANBAN_BG_COLORS: 'kanbanBgColors',
  DOC_LAYOUT: 'docLayout',
  DOC_FAQ_LAYOUT: 'docFaqLayout',
  BRAND_LAYOUT: 'brandLayout',
  TAG_LAYOUT: 'tagLayout',
  AVATAR_LAYOUT: 'avatarLayout',
  BANNER_LAYOUT: 'bannerLayout',
  HEADER_LAYOUT: 'headerLayout',
  FOOTER_LAYOUT: 'footerLayout',
  TOPBAR_LAYOUT: 'topbarLayout',
  TOPBAR_BG: 'topbarBg',
  BROADCAST_LAYOUT: 'broadcastLayout',
  BROADCAST_ARTICLE_LAYOUT: 'broadcastArticleLayout',
  BROADCAST_BG: 'broadcastBg',
  BROADCAST_ARTICLE_BG: 'broadcastArticleBg',
  CHANGELOG_LAYOUT: 'changelogLayout',
  GLOW_TYPE: 'glowType',
  GLOW_FIXED: 'glowFixed',
  GLOW_OPACITY: 'glowOpacity',
  GAUSS_BLUR: 'gaussBlur',
  GAUSS_BLUR_DARK: 'gaussBlurDark',
}

export const FIELD = {
  ...LAYOUT_FIELD,
  ENABLE: 'enable',
  BASE_INFO: 'baseInfo',
  MEDIA_REPORTS: 'mediaReports',
  SEO: 'seo',
  SOCIAL_LINKS: 'socialLinks',
  HEADER_LINKS: 'headerLinks',
  FOOTER_LINKS: 'footerLinks',
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
  PAGE_BG: 'pageBg',
  PAGE_BG_DARK: 'pageBgDark',
  BROADCAST_ENABLE: 'broadcastEnable',
} as const

export const MENU = {
  BASIC: {
    title: '工作区',
    icon: 'basic',
    initFold: false,
    children: [
      {
        title: '概览',
        slug: DSB_ROUTE.OVERVIEW,
      },
      {
        title: '基本信息',
        slug: DSB_ROUTE.INFO,
      },
      {
        title: 'SEO',
        slug: DSB_ROUTE.SEO,
      },
      {
        title: '板块管理',
        slug: DSB_ROUTE.THREADS,
      },
      {
        title: '布局与样式',
        slug: DSB_ROUTE.LAYOUT,
      },
      {
        title: '别名',
        slug: DSB_ROUTE.ALIAS,
        alias: FIELD.NAME_ALIAS,
      },
      {
        title: '管理员',
        slug: DSB_ROUTE.ADMINS,
      },
      {
        title: '页眉',
        slug: DSB_ROUTE.HEADER,
      },
      {
        title: '页脚',
        slug: DSB_ROUTE.FOOTER,
      },
    ],
  },

  CMS: {
    title: '内容管理',
    icon: 'cms',
    initFold: false,
    children: [
      {
        title: '社区',
        slug: DSB_ROUTE.COMMUNITIES,
      },
      {
        title: '标签',
        slug: DSB_ROUTE.TAGS,
      },
      {
        title: '帖子',
        slug: DSB_ROUTE.POST,
      },
      {
        title: '更新日志',
        slug: DSB_ROUTE.CHANGELOG,
      },
      {
        title: '帮助台',
        slug: DSB_ROUTE.DOC,
      },
      {
        title: '广播',
        slug: DSB_ROUTE.BROADCAST,
      },
      {
        title: '小黑屋',
        slug: DSB_ROUTE.BLACKHOUSE,
      },
      {
        title: 'RSS',
        slug: DSB_ROUTE.RSS,
      },
      {
        title: '导入/导出',
        slug: DSB_ROUTE.INOUT,
      },
    ],
  },

  ANALYSIS: {
    title: '统计分析',
    icon: 'analysis',
    initFold: true,
    children: [
      {
        title: '趋势',
        slug: DSB_ROUTE.TREND,
      },
      {
        title: '日志',
        slug: DSB_ROUTE.LOG,
      },
    ],
  },

  INTEGRATE: {
    title: '绑定集成',
    icon: 'bind',
    initFold: false,
    children: [
      {
        title: '域名绑定',
        slug: DSB_ROUTE.DOMAIN,
      },
      {
        title: '三方集成',
        slug: DSB_ROUTE['THIRD-PART'],
      },
      {
        title: '网站插件',
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
  todo: ['Todo', '已排期', '评估中', '计划中'],
  wip: ['Wip', '完善中'],
  done: ['Done', '已解决'],
  // state
  feature: ['功能建议', '功能需求', '新功能'],
  question: ['求助 / 疑问', '使用帮助'],
  bug: ['问题上报', '缺陷', 'issue', 'bug'],
  other: ['其他讨论', '其他话题'],
  // TODO
  state_other: ['其他讨论'],
}

export const DOC_TABS = [
  {
    title: '概览',
    slug: DSB_DOC_ROUTE.TABLE,
  },
  {
    title: '目录编排',
    slug: DSB_DOC_ROUTE.TREE,
  },
  {
    title: '封面图标',
    slug: DSB_DOC_ROUTE.COVER,
  },
  {
    title: '常见问题',
    slug: DSB_DOC_ROUTE.FAQ,
  },
]

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
export const BASEINFO_OTHER_KEYS: (keyof TDsbFieldMap)[] = ['city', 'techstack']

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

export const INIT_KANBAN_COLORS = [COLOR_NAME.BLACK, COLOR_NAME.BLACK, COLOR_NAME.BLACK]
