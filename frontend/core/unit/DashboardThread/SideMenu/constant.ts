import {
  DSB_CHANGELOG_ROUTE,
  DSB_DOC_LAYOUT_ROUTE,
  DSB_DOC_ROUTE,
  DSB_KANBAN_ROUTE,
  DSB_POST_ROUTE,
  DSB_ROUTE,
} from '~/const/route'
import type { TTransKey } from '~/spec'

import { MENU_VIEW } from '../constant'
import type { TDsbMenuIcon } from './icons'

export type TSubMenuScope = 'changelog' | 'doc' | 'kanban' | 'post'

export type TSubMenuItem = {
  icon: TDsbMenuIcon
  path: string
  slug: string
  title: TTransKey
}

export const DOC_MENU_ITEMS = [
  {
    icon: 'analysis',
    title: 'dsb.menu.doc.analysis',
    slug: DSB_DOC_ROUTE.ANALYSIS,
    path: DSB_DOC_ROUTE.ANALYSIS,
  },
  {
    icon: 'layout',
    title: 'dsb.menu.doc.layout',
    slug: DSB_DOC_ROUTE.LAYOUT,
    path: `${DSB_DOC_ROUTE.LAYOUT}/${DSB_DOC_LAYOUT_ROUTE.COVER}`,
  },
  {
    icon: 'cover',
    title: 'dsb.menu.doc.cover',
    slug: DSB_DOC_ROUTE.COVER,
    path: DSB_DOC_ROUTE.COVER,
  },
  {
    icon: 'editor',
    title: 'dsb.menu.doc.editor',
    slug: DSB_DOC_ROUTE.EDITOR,
    path: DSB_DOC_ROUTE.EDITOR,
  },
  {
    icon: 'faq',
    title: 'dsb.menu.doc.faq',
    slug: DSB_DOC_ROUTE.FAQ,
    path: DSB_DOC_ROUTE.FAQ,
  },
  {
    icon: 'gitSync',
    title: 'dsb.menu.doc.git_sync',
    slug: DSB_DOC_ROUTE.GIT_SYNC,
    path: DSB_DOC_ROUTE.GIT_SYNC,
  },
  {
    icon: 'secureDomain',
    title: 'dsb.menu.doc.domain',
    slug: DSB_DOC_ROUTE.DOMAIN,
    path: DSB_DOC_ROUTE.DOMAIN,
  },
  {
    icon: 'import',
    title: 'dsb.menu.doc.import',
    slug: DSB_DOC_ROUTE.IMPORT,
    path: DSB_DOC_ROUTE.IMPORT,
  },
  {
    icon: 'backup',
    title: 'dsb.menu.doc.backup',
    slug: DSB_DOC_ROUTE.BACKUP,
    path: DSB_DOC_ROUTE.BACKUP,
  },
] as const

export const POST_MENU_ITEMS = [
  {
    icon: 'analysis',
    title: 'dsb.menu.post.analysis',
    slug: DSB_POST_ROUTE.ANALYSIS,
    path: DSB_POST_ROUTE.ANALYSIS,
  },
  {
    icon: 'layout',
    title: 'dsb.menu.post.layout',
    slug: DSB_POST_ROUTE.LAYOUT,
    path: DSB_POST_ROUTE.LAYOUT,
  },
  {
    icon: 'content',
    title: 'dsb.menu.post.content',
    slug: DSB_POST_ROUTE.CONTENT,
    path: DSB_POST_ROUTE.CONTENT,
  },
  {
    icon: 'behavior',
    title: 'dsb.menu.post.behavior',
    slug: DSB_POST_ROUTE.BEHAVIOR,
    path: DSB_POST_ROUTE.BEHAVIOR,
  },
] as const

export const KANBAN_MENU_ITEMS = [
  {
    icon: 'analysis',
    title: 'dsb.menu.kanban.analysis',
    slug: DSB_KANBAN_ROUTE.ANALYSIS,
    path: DSB_KANBAN_ROUTE.ANALYSIS,
  },
  {
    icon: 'layout',
    title: 'dsb.menu.kanban.layout',
    slug: DSB_KANBAN_ROUTE.LAYOUT,
    path: DSB_KANBAN_ROUTE.LAYOUT,
  },
  {
    icon: 'content',
    title: 'dsb.menu.kanban.content',
    slug: DSB_KANBAN_ROUTE.CONTENT,
    path: DSB_KANBAN_ROUTE.CONTENT,
  },
  {
    icon: 'behavior',
    title: 'dsb.menu.kanban.behavior',
    slug: DSB_KANBAN_ROUTE.BEHAVIOR,
    path: DSB_KANBAN_ROUTE.BEHAVIOR,
  },
] as const

export const CHANGELOG_MENU_ITEMS = [
  {
    icon: 'analysis',
    title: 'dsb.menu.changelog.analysis',
    slug: DSB_CHANGELOG_ROUTE.ANALYSIS,
    path: DSB_CHANGELOG_ROUTE.ANALYSIS,
  },
  {
    icon: 'layout',
    title: 'dsb.menu.changelog.layout',
    slug: DSB_CHANGELOG_ROUTE.LAYOUT,
    path: DSB_CHANGELOG_ROUTE.LAYOUT,
  },
  {
    icon: 'content',
    title: 'dsb.menu.changelog.content',
    slug: DSB_CHANGELOG_ROUTE.CONTENT,
    path: DSB_CHANGELOG_ROUTE.CONTENT,
  },
  {
    icon: 'behavior',
    title: 'dsb.menu.changelog.behavior',
    slug: DSB_CHANGELOG_ROUTE.BEHAVIOR,
    path: DSB_CHANGELOG_ROUTE.BEHAVIOR,
  },
] as const

export const SUBMENU_ROUTE_VIEW = {
  [DSB_ROUTE.DOC]: MENU_VIEW.DOC,
  [DSB_ROUTE.POST]: MENU_VIEW.POST,
  [DSB_ROUTE.KANBAN]: MENU_VIEW.KANBAN,
  [DSB_ROUTE.CHANGELOG]: MENU_VIEW.CHANGELOG,
} as const

export const SUBMENU_CONFIG = {
  [MENU_VIEW.DOC]: {
    baseRoute: DSB_ROUTE.DOC,
    defaultSlug: DSB_DOC_ROUTE.LAYOUT,
    entryPath: `${DSB_ROUTE.DOC}/${DSB_DOC_ROUTE.EDITOR}`,
    entrySlug: DSB_DOC_ROUTE.EDITOR,
    items: DOC_MENU_ITEMS,
    scope: 'doc',
  },
  [MENU_VIEW.POST]: {
    baseRoute: DSB_ROUTE.POST,
    defaultSlug: DSB_POST_ROUTE.CONTENT,
    entryPath: `${DSB_ROUTE.POST}/${DSB_POST_ROUTE.CONTENT}`,
    entrySlug: DSB_POST_ROUTE.CONTENT,
    items: POST_MENU_ITEMS,
    scope: 'post',
  },
  [MENU_VIEW.KANBAN]: {
    baseRoute: DSB_ROUTE.KANBAN,
    defaultSlug: DSB_KANBAN_ROUTE.CONTENT,
    entryPath: `${DSB_ROUTE.KANBAN}/${DSB_KANBAN_ROUTE.CONTENT}`,
    entrySlug: DSB_KANBAN_ROUTE.CONTENT,
    items: KANBAN_MENU_ITEMS,
    scope: 'kanban',
  },
  [MENU_VIEW.CHANGELOG]: {
    baseRoute: DSB_ROUTE.CHANGELOG,
    defaultSlug: DSB_CHANGELOG_ROUTE.CONTENT,
    entryPath: `${DSB_ROUTE.CHANGELOG}/${DSB_CHANGELOG_ROUTE.CONTENT}`,
    entrySlug: DSB_CHANGELOG_ROUTE.CONTENT,
    items: CHANGELOG_MENU_ITEMS,
    scope: 'changelog',
  },
} satisfies Record<
  Exclude<`${MENU_VIEW}`, `${MENU_VIEW.MAIN}`>,
  {
    baseRoute: string
    defaultSlug: string
    entryPath: string
    entrySlug: string
    items: readonly TSubMenuItem[]
    scope: TSubMenuScope
  }
>
