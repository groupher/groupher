import { valueKeyedEnum } from '~/lib/enumValues'
import { ArticleThread, KanbanBoard, Thread } from '~/lib/graphql/generated/enums'

export const ARTICLE_THREAD = valueKeyedEnum(ArticleThread)

export const KANBAN_BOARD = valueKeyedEnum(KanbanBoard)

const { USER: _user, ...THREAD_VALUES } = valueKeyedEnum(Thread)

export const THREAD = THREAD_VALUES

const ARTICLE_THREAD_PATH = {
  POST: 'post',
  BLOG: 'blog',
  CHANGELOG: 'changelog',
  DOC: 'doc',
  KANBAN: 'kanban',
} as const

export const THREAD_PATH = {
  ...ARTICLE_THREAD_PATH,
  ACCOUNT: 'account',
  ABOUT: 'about',
  DASHBOARD: 'dashboard',
} as const

export const TICKET_PATH = 'ticket' as const

export const TAG_THREADS = [THREAD.POST, THREAD.BLOG, THREAD.CHANGELOG, THREAD.DOC] as const

export const COMMUNITY_THREADS = [
  { title: 'Posts', slug: THREAD_PATH.POST, index: 0 },
  { title: 'Blogs', slug: THREAD_PATH.BLOG, index: 1 },
  { title: 'Kanban', slug: THREAD_PATH.KANBAN, index: 2 },
  { title: 'Changelog', slug: THREAD_PATH.CHANGELOG, index: 3 },
  { title: 'Docs', slug: THREAD_PATH.DOC, index: 4 },
  { title: 'About', slug: THREAD_PATH.ABOUT, index: 5 },
] as const
