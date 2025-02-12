import type { TWidgetType } from '~/spec'

import { COLOR_NAME } from '~/const/colors'

export const ONE_LINK_GROUP = '__ONE_LINK_GROUP__'
export const MORE_GROUP = '__MORE_GROUP__'

export const INIT_KANBAN_COLORS = [COLOR_NAME.BLACK, COLOR_NAME.BLACK, COLOR_NAME.BLACK]

export const DEFAULT_ENABLE = {
  post: true,
  kanban: true,
  changelog: true,
  //
  doc: true,
  docLastUpdate: true,
  docReaction: true,
  //
  about: true,
  aboutTechstack: true,
  aboutLocation: true,
  aboutLinks: true,
  aboutMediaReport: true,
}

export const WIDGET_TYPE = {
  SIDEBAR: 'sidebar',
  MODAL: 'modal',
  POPUP: 'popup',
  IFRAME: 'iframe',
  LINK: 'link',
} as Record<Uppercase<TWidgetType>, TWidgetType>

export const TW_CARD = {
  SUMMARY: 'summary',
  SUMMARY_LARGE_IMAGE: 'summary_large_image',
}

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
