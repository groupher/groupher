import { BUILTIN_ALIAS } from '~/const/builtin-alias'
import { COLOR } from '~/const/colors'
import { DEFAULT_ENABLE, INIT_KANBAN_BOARDS, TW_CARD } from '~/const/dashboard'
import { LOCALE } from '~/const/i18n'
import {
  AVATAR_LAYOUT,
  BRAND_LAYOUT,
  BROADCAST_ARTICLE_LAYOUT,
  BROADCAST_LAYOUT,
  CHANGELOG_LAYOUT,
  COMMUNITY_LAYOUT,
  DOC_COVER_LAYOUT,
  DOC_FAQ_LAYOUT,
  FOOTER_LAYOUT,
  HEADER_LAYOUT,
  INLINE_TAG_LAYOUT,
  KANBAN_CARD_LAYOUT,
  KANBAN_LAYOUT,
  NAV_ACTIVE_LAYOUT,
  POST_LAYOUT,
  RSS_TYPE,
  TAG_LAYOUT,
} from '~/const/layout'
import SIZE from '~/const/size'
import { DEFAULT_THEME_PRESET } from '~/const/theme_preset'
import { THREAD } from '~/const/thread'

import type { TDsbFieldMap } from './spec'

export const DEFAULT_DOC_FAQ = {
  title: 'FAQ',
  desc: 'Common questions about docs',
  groupedView: true,
  groupItems: [
    {
      id: 'grp_basics',
      title: 'Basics',
      index: 0,
      items: [
        {
          id: 'faq_what_are_docs',
          title: 'What are docs for?',
          detail: 'Use docs to publish guides, references, and product help for your community.',
          index: 0,
        },
        {
          id: 'faq_how_to_update',
          title: 'How do I update a question?',
          detail: 'Open a question, edit the markdown answer, then save the FAQ.',
          index: 1,
        },
      ],
    },
    {
      id: 'grp_publishing',
      title: 'Publishing',
      index: 1,
      items: [
        {
          id: 'faq_when_visible',
          title: 'When are FAQ changes visible?',
          detail: 'FAQ changes are visible after the dashboard save completes.',
          index: 0,
        },
      ],
    },
  ],
  flatItems: [
    {
      id: 'faq_get_started',
      title: 'How do I get started?',
      detail: 'Create your first guide, add a few common questions, then publish the docs.',
      index: 0,
    },
    {
      id: 'faq_markdown',
      title: 'Can answers use Markdown?',
      detail: 'Yes. FAQ answers support markdown formatting, links, and inline code.',
      index: 1,
    },
  ],
}

export const DEFAULT_OVERVIEW = {
  views: 0,
  subscribersCount: 0,
  postsCount: 0,
  changelogsCount: 0,
  docsCount: 0,
}

const EMPTY_MEDIA_REPORT = {
  index: 0,
  title: '',
  favicon: '',
  siteName: '',
  url: '',
  editUrl: '',
}

const INIT_KANBAN_COLORS = [COLOR.BLACK, COLOR.YELLOW, COLOR.PURPLE, COLOR.GREEN, COLOR.RED]
export const FIELDS: TDsbFieldMap = {
  // baseInfo
  favicon: '',
  logo: '',
  locale: LOCALE.EN,
  title: '',
  slug: '',
  desc: '',
  introduction: '',
  homepage: '',
  city: '',
  techstack: '',

  // social
  socialLinks: [],
  mediaReports: [EMPTY_MEDIA_REPORT],

  // page
  themePreset: DEFAULT_THEME_PRESET,
  themePresetBase: DEFAULT_THEME_PRESET,
  themeTokens: {},
  themePresets: [],
  themeOverwrite: {},

  // seo
  seoEnable: true,
  ogSiteName: '',
  ogTitle: '',
  ogDescription: '',
  ogUrl: '',
  ogImage: '',
  ogLocale: '',
  ogPublisher: '',

  twTitle: '',
  twDescription: '',
  twUrl: '',
  twCard: TW_CARD.SUMMARY,
  twSite: '',
  twImage: '',
  twImageWidth: '',
  twImageHeight: '',

  // layout
  postLayout: POST_LAYOUT.QUORA,
  kanbanLayout: KANBAN_LAYOUT.CLASSIC,
  kanbanCardLayout: KANBAN_CARD_LAYOUT.SIMPLE,
  kanbanBoards: INIT_KANBAN_BOARDS,
  kanbanBgColors: INIT_KANBAN_COLORS,

  docCoverLayout: DOC_COVER_LAYOUT.STACK_CARDS,
  docFaqLayout: DOC_FAQ_LAYOUT.COLLAPSE,
  tagLayout: TAG_LAYOUT.HASH,
  inlineTagLayout: INLINE_TAG_LAYOUT.BORDER,
  avatarLayout: AVATAR_LAYOUT.SQUARE,
  brandLayout: BRAND_LAYOUT.BOTH,
  communityLayout: COMMUNITY_LAYOUT.CLASSIC,
  navActiveLayout: NAV_ACTIVE_LAYOUT.TEXT,
  topbarEnabled: false,
  topbarBg: COLOR.ORANGE,
  topbarBgCustomColor: '',

  broadcastLayout: BROADCAST_LAYOUT.DEFAULT,
  broadcastBg: COLOR.BLACK,
  broadcastCustomBg: '',
  broadcastEnable: false,

  broadcastArticleLayout: BROADCAST_ARTICLE_LAYOUT.DEFAULT,
  broadcastArticleBg: COLOR.RED,
  broadcastArticleCustomBg: '',
  broadcastArticleEnable: true,

  changelogLayout: CHANGELOG_LAYOUT.CLASSIC,

  // doc
  docCategories: [],

  overlayDark: true,

  // contents
  // tags
  tagGroups: [],
  activeTagGroup: null,
  activeTagThread: THREAD.POST,
  nameAlias: BUILTIN_ALIAS,
  enable: DEFAULT_ENABLE,

  docFaq: DEFAULT_DOC_FAQ,
  rssFeedType: RSS_TYPE.DIGEST,
  rssFeedCount: 5,

  headerLayout: HEADER_LAYOUT.CENTER,
  footerLayout: FOOTER_LAYOUT.GROUP,

  footerLinks: [],
  footerOnelineLinks: [],
  headerLinks: [],

  // moderators
  moderators: [],

  // widgets
  widgetsPrimaryColor: COLOR.BLACK,
  widgetsThreads: [THREAD.POST],
  widgetsSize: SIZE.MEDIUM,
}
