import { DSB_CHANGELOG_ROUTE, DSB_DOC_ROUTE, DSB_POST_ROUTE } from '~/const/route'

export const DOC_MENU_ITEMS = [
  {
    title: 'dsb.menu.doc.analysis',
    slug: DSB_DOC_ROUTE.ANALYSIS,
    path: DSB_DOC_ROUTE.ANALYSIS,
  },
  {
    title: 'dsb.menu.doc.layout',
    slug: DSB_DOC_ROUTE.LAYOUT,
    path: DSB_DOC_ROUTE.LAYOUT,
  },
  {
    title: 'dsb.menu.doc.editor',
    slug: DSB_DOC_ROUTE.EDITOR,
    path: DSB_DOC_ROUTE.EDITOR,
  },
  {
    title: 'dsb.menu.doc.faq',
    slug: DSB_DOC_ROUTE.FAQ,
    path: DSB_DOC_ROUTE.FAQ,
  },
  {
    title: 'dsb.menu.doc.git_sync',
    slug: DSB_DOC_ROUTE.GIT_SYNC,
    path: DSB_DOC_ROUTE.GIT_SYNC,
  },
  {
    title: 'dsb.menu.doc.domain',
    slug: DSB_DOC_ROUTE.DOMAIN,
    path: DSB_DOC_ROUTE.DOMAIN,
  },
  {
    title: 'dsb.menu.doc.import',
    slug: DSB_DOC_ROUTE.IMPORT,
    path: DSB_DOC_ROUTE.IMPORT,
  },
  {
    title: 'dsb.menu.doc.backup',
    slug: DSB_DOC_ROUTE.BACKUP,
    path: DSB_DOC_ROUTE.BACKUP,
  },
] as const

export const POST_MENU_ITEMS = [
  {
    title: 'dsb.menu.post.analysis',
    slug: DSB_POST_ROUTE.ANALYSIS,
    path: DSB_POST_ROUTE.ANALYSIS,
  },
  {
    title: 'dsb.menu.post.layout',
    slug: DSB_POST_ROUTE.LAYOUT,
    path: DSB_POST_ROUTE.LAYOUT,
  },
  {
    title: 'dsb.menu.post.content',
    slug: DSB_POST_ROUTE.CONTENT,
    path: DSB_POST_ROUTE.CONTENT,
  },
  {
    title: 'dsb.menu.post.behavior',
    slug: DSB_POST_ROUTE.BEHAVIOR,
    path: DSB_POST_ROUTE.BEHAVIOR,
  },
] as const

export const CHANGELOG_MENU_ITEMS = [
  {
    title: 'dsb.menu.changelog.analysis',
    slug: DSB_CHANGELOG_ROUTE.ANALYSIS,
    path: DSB_CHANGELOG_ROUTE.ANALYSIS,
  },
  {
    title: 'dsb.menu.changelog.layout',
    slug: DSB_CHANGELOG_ROUTE.LAYOUT,
    path: DSB_CHANGELOG_ROUTE.LAYOUT,
  },
  {
    title: 'dsb.menu.changelog.content',
    slug: DSB_CHANGELOG_ROUTE.CONTENT,
    path: DSB_CHANGELOG_ROUTE.CONTENT,
  },
  {
    title: 'dsb.menu.changelog.behavior',
    slug: DSB_CHANGELOG_ROUTE.BEHAVIOR,
    path: DSB_CHANGELOG_ROUTE.BEHAVIOR,
  },
] as const
