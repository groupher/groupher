import type { TArticleTocItem } from '~/ui/ArticleToc'

export const DOC_ARTICLE_TOC_ACTIVE_ID = 'toc'

export const DOC_ARTICLE_TOC_ITEMS: readonly TArticleTocItem[] = [
  { id: 'start', title: '开始使用文档', level: 2 },
  { id: 'layout', title: '阅读区布局', level: 3 },
  { id: 'toc', title: '自动目录高亮', level: 2 },
  { id: 'share', title: '复制与分享', level: 3 },
  { id: 'feedback', title: '文档反馈入口', level: 2 },
  { id: 'next', title: '下一篇导航', level: 3 },
]
