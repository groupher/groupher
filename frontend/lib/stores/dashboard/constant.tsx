import type { TSnakeUpperCase, TWidgetType } from '~/spec'

import {
  DASHBOARD_ROUTE,
  DASHBOARD_LAYOUT_ROUTE,
  DASHBOARD_BROADCAST_ROUTE,
  DASHBOARD_ALIAS_ROUTE,
  DASHBOARD_BASEINFO_ROUTE,
  DASHBOARD_SEO_ROUTE,
  DASHBOARD_DOC_ROUTE,
} from '~/const/route'
import { COLOR_NAME } from '~/const/colors'

import type { TSettingField, THeaderEditType, TFooterEditType } from './spec'

// import { Icon } from './styles/side_menu'

export { SEO_KEYS, SEO_OG_KEYS, SEO_TW_KEYS } from '~/const/seo'

export const ALIGN_HEADER_OFFSET = '100px'

// for local store, demo setting usage
export const DASHBOARD_DEMO_KEY = 'dashboard_demo'

// do not change, it's map to GQ endpoint updateDashboardLayout
export const SETTING_LAYOUT_FIELD = {
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
  GOSS_BLUR: 'gossBlur',
  GOSS_BLUR_DARK: 'gossBlurDark',
}

export const SETTING_FIELD = {
  ...SETTING_LAYOUT_FIELD,
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
  GOSS_BLUR: 'gossBlur',
  BROADCAST_ENABLE: 'broadcastEnable',
  ENABLE: 'enable',
} as Record<TSnakeUpperCase<TSettingField>, TSettingField>

export const MENU = {
  BASIC: {
    title: '工作区',
    icon: null, //<Icon.Basic />,
    initFold: false,
    children: [
      {
        title: '概览',
        slug: DASHBOARD_ROUTE.DASHBOARD,
      },
      {
        title: '基本信息',
        slug: DASHBOARD_ROUTE.INFO,
      },
      {
        title: 'SEO',
        slug: DASHBOARD_ROUTE.SEO,
      },
      {
        title: '社区板块',
        slug: DASHBOARD_ROUTE.THREADS,
      },
      {
        title: '布局与样式',
        slug: DASHBOARD_ROUTE.LAYOUT,
      },
      {
        title: '别名',
        slug: DASHBOARD_ROUTE.ALIAS,
        alias: SETTING_FIELD.NAME_ALIAS,
      },
      {
        title: '管理员',
        slug: DASHBOARD_ROUTE.ADMINS,
      },
      {
        title: '页眉',
        slug: DASHBOARD_ROUTE.HEADER,
      },
      {
        title: '页脚',
        slug: DASHBOARD_ROUTE.FOOTER,
      },
      {
        title: '导入/导出',
        slug: DASHBOARD_ROUTE.INOUT,
      },
    ],
  },

  CMS: {
    title: '内容管理',
    icon: null, // <Icon.Management />,
    initFold: false,
    children: [
      {
        title: '社区',
        slug: DASHBOARD_ROUTE.COMMUNITIES,
      },
      {
        title: '标签',
        slug: DASHBOARD_ROUTE.TAGS,
      },
      {
        title: '帖子',
        slug: DASHBOARD_ROUTE.POST,
      },
      {
        title: '更新日志',
        slug: DASHBOARD_ROUTE.CHANGELOG,
      },
      {
        title: '帮助台',
        slug: DASHBOARD_ROUTE.DOC,
      },
      {
        title: '广播',
        slug: DASHBOARD_ROUTE.BROADCAST,
      },
      {
        title: '小黑屋',
        slug: DASHBOARD_ROUTE.BLACKHOUSE,
      },
      {
        title: 'RSS',
        slug: DASHBOARD_ROUTE.RSS,
      },
    ],
  },

  ANALYSIS: {
    title: '统计分析',
    icon: null, // <Icon.Analysis />,
    initFold: true,
    children: [
      {
        title: '趋势',
        slug: DASHBOARD_ROUTE.TREND,
      },
      {
        title: '日志',
        slug: DASHBOARD_ROUTE.LOG,
      },
    ],
  },

  INTEGRATE: {
    title: '绑定集成',
    icon: null, // <Icon.Bind />,
    initFold: true,
    children: [
      {
        title: '自定义域名',
        slug: DASHBOARD_ROUTE.DOMAIN,
      },
      {
        title: '外部应用',
        slug: DASHBOARD_ROUTE.THIRD_PART,
      },
      {
        title: '网站插件',
        slug: DASHBOARD_ROUTE.WIDGETS,
      },
    ],
  },
}

export const ALIAS_GROUP = {
  THREAD: DASHBOARD_ALIAS_ROUTE.THREAD,
  KANBAN: DASHBOARD_ALIAS_ROUTE.KANBAN,
  OTHERS: DASHBOARD_ALIAS_ROUTE.OTHERS,
}

export const BUILDIN_ALIAS_SUGGESTIONS = {
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

export const WIDGET_TYPE = {
  SIDEBAR: 'sidebar',
  MODAL: 'modal',
  POPUP: 'popup',
  IFRAME: 'iframe',
  LINK: 'link',
} as Record<Uppercase<TWidgetType>, TWidgetType>

export const DEFAULT_OVERVIEW = {
  views: 0,
  subscribersCount: 0,
  postsCount: 0,
  changelogsCount: 0,
  docsCount: 0,
}

export const WIDGET_TYPES = [
  {
    title: '侧边栏',
    slug: WIDGET_TYPE.SIDEBAR,
  },
  {
    title: '居中模态框',
    slug: WIDGET_TYPE.MODAL,
  },
  {
    title: '弹出提示',
    slug: WIDGET_TYPE.POPUP,
  },
  {
    title: '页面内嵌',
    slug: WIDGET_TYPE.IFRAME,
  },
  {
    title: '链接',
    slug: WIDGET_TYPE.LINK,
  },
]

export const HEADER_EDIT_TYPE = {
  LOGO: 'logo',
  TITLE: 'title',
} as Record<Uppercase<THeaderEditType>, THeaderEditType>

export const FOOTER_EDIT_TYPE = {
  LOGO: 'logo',
  TITLE: 'title',
  SOCIAL: 'social',
} as Record<Uppercase<TFooterEditType>, TFooterEditType>

export const BASEINFO_TABS = [
  {
    title: '基本信息',
    slug: DASHBOARD_BASEINFO_ROUTE.BASIC,
  },
  {
    title: 'Logo',
    slug: DASHBOARD_BASEINFO_ROUTE.LOGOS,
  },
  {
    title: '社交媒体',
    slug: DASHBOARD_BASEINFO_ROUTE.SOCIAL,
  },
  {
    title: '其他',
    slug: DASHBOARD_BASEINFO_ROUTE.OTHER,
  },
]

export const SEO_TABS = [
  {
    title: '搜索引擎',
    slug: DASHBOARD_SEO_ROUTE.SEARCH_ENGINE,
  },
  {
    title: 'Twitter',
    slug: DASHBOARD_SEO_ROUTE.TWITTER,
  },
]

export const LAYOUT_TABS = [
  {
    title: '通用',
    slug: DASHBOARD_LAYOUT_ROUTE.GENERAL,
  },
  {
    title: '主题/背景',
    slug: DASHBOARD_LAYOUT_ROUTE.THEME,
  },
  {
    title: '讨论区',
    slug: DASHBOARD_LAYOUT_ROUTE.POST,
  },
  {
    title: '看板',
    slug: DASHBOARD_LAYOUT_ROUTE.KANBAN,
  },
  {
    title: '更新日志',
    slug: DASHBOARD_LAYOUT_ROUTE.CHANGELOG,
  },
  {
    title: '帮助台',
    slug: DASHBOARD_LAYOUT_ROUTE.DOC,
  },
]

export const BROADCAST_TABS = [
  {
    title: '站顶横幅',
    slug: DASHBOARD_BROADCAST_ROUTE.GLOBAL,
  },
  {
    title: '帖子页脚',
    slug: DASHBOARD_BROADCAST_ROUTE.ARTICLE,
  },
]

export const DOC_TABS = [
  {
    title: '概览',
    slug: DASHBOARD_DOC_ROUTE.TABLE,
  },
  {
    title: '目录编排',
    slug: DASHBOARD_DOC_ROUTE.TREE,
  },
  {
    title: '封面图标',
    slug: DASHBOARD_DOC_ROUTE.COVER,
  },
  {
    title: '常见问题',
    slug: DASHBOARD_DOC_ROUTE.FAQ,
  },
]

export const TW_CARD = {
  SUMMARY: 'summary',
  SUMMARY_LARGE_IMAGE: 'summary_large_image',
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

export const ALIAS_TABS = [
  {
    title: '板块入口',
    slug: DASHBOARD_ALIAS_ROUTE.THREAD,
  },
  {
    title: '看板',
    slug: DASHBOARD_ALIAS_ROUTE.KANBAN,
  },
  {
    title: '其他',
    slug: DASHBOARD_ALIAS_ROUTE.OTHERS,
  },
]

export const EMPTY_LINK_ITEM = {
  title: '',
  link: '',
  index: 0,
  group: '',
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

export const demoMarkdown = `
  this is a paragraph 

  - this is a list
  - this is a list 2
  - this is a list 3


  \`\`\`js
  var some = code();
  \`\`\`
`

export const DEFAULT_FAQ_ITEMS = [
  // {
  //   index: 0,
  //   title: '如何使用 Groupher？',
  //   body: '如何使用 Groupher 的内容，我将在这片文档继续分享相关话题',
  // },
  // {
  //   index: 1,
  //   title: 'Groupher 是免费的吗',
  //   body: demoMarkdown,
  // },
  // {
  //   index: 2,
  //   title: 'Groupher 可以独立部署吗',
  //   body: demoMarkdown,
  // },
]

export const DEFAULT_LINK_ITEMS = [
  {
    title: '讨论区',
    link: 'https://groupher.com/home/post',
    index: 0,
    group: 'Group 0',
    groupIndex: 0,
  },
  {
    title: '看板',
    link: 'https://groupher.com/home/kanban',
    index: 1,
    group: 'Group 0',
    groupIndex: 0,
  },
  {
    title: '更新日志',
    link: 'https://groupher.com/home/changelog',
    index: 2,
    group: 'Group 0',
    groupIndex: 0,
  },
  {
    title: '帮助台',
    link: 'https://groupher.com/home/help',
    index: 3,
    group: 'Group 0',
    groupIndex: 0,
  },
  {
    title: '关于',
    link: 'https://groupher.com/home/about',
    index: 4,
    group: 'Group 0',
    groupIndex: 0,
  },

  // group 1
  {
    title: '布局设置',
    link: 'https://groupher.com/home/post',
    index: 0,
    group: 'Group 1',
    groupIndex: 1,
  },
  {
    title: '看板设置',
    link: 'https://groupher.com/home/kanban',
    index: 1,
    group: 'Group 1',
    groupIndex: 1,
  },
  {
    title: '更新日志设置',
    link: 'https://groupher.com/home/changelog',
    index: 2,
    group: 'Group 1',
    groupIndex: 1,
  },

  //
  {
    title: '与 xxx 的对比',
    link: 'https://groupher.com/home/post',
    index: 0,
    group: 'Group 2',
    groupIndex: 2,
  },
  {
    title: '帮助中心',
    link: 'https://groupher.com/home/kanban',
    index: 1,
    group: 'Group 2',
    groupIndex: 2,
  },
  {
    title: '联系我们',
    link: 'https://groupher.com/home/changelog',
    index: 2,
    group: 'Group 2',
    groupIndex: 2,
  },
]

export const BASEINFO_BASIC_KEYS = [
  'favicon',
  'locale',
  'logo',
  'title',
  'desc',
  'introduction',
  'homepage',
  'slug',
]

export const BASEINFO_OTHER_KEYS = ['city', 'techstack']

export const BASEINFO_KEYS = [...BASEINFO_BASIC_KEYS, ...BASEINFO_OTHER_KEYS]

export const HEADER_SETTING_KEYS = [
  'saving',
  'headerLayout',
  'headerLinks',
  'editingLink',
  'editingLinkMode',
  'editingGroup',
  'editingGroupIndex',
]

export const FOOTER_SETTING_KEYS = [
  'saving',
  'footerLayout',
  'footerLinks',
  'editingLink',
  'editingLinkMode',
  'editingGroup',
  'editingGroupIndex',
]

// export const UI_KEYS = [
//   'layoutTab',
//   'primaryColor',
//   'brandLayout',
//   'tagLayout',
//   'avatarLayout',
//   'bannerLayout',
//   'topbarLayout',
//   'topbarBg',
//   'postLayout',
//   'kanbanLayout',
//   'kanbanCardLayout',
//   'docLayout',
//   'docFaqLayout',
//   'changelogLayout',
//   'glowFixed',
//   'glowType',
//   'glowOpacity',
//   'gossBlur',
//   'gossBlurDark',
// ]

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
