export const ARTICLE_THREAD = {
  POST: 'POST',
  BLOG: 'BLOG',
  CHANGELOG: 'CHANGELOG',
  DOC: 'DOC',
  KANBAN: 'KANBAN',
} as const

export const KANBAN_BOARD = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  WIP: 'WIP',
  DONE: 'DONE',
  REJECTED: 'REJECTED',
} as const

export const THREAD = {
  ...ARTICLE_THREAD,
  ACCOUNT: 'ACCOUNT',
  // for groupher

  ABOUT: 'ABOUT',
  DASHBOARD: 'DASHBOARD',
} as const

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

export const TAG_THREADS = [THREAD.POST, THREAD.BLOG, THREAD.CHANGELOG, THREAD.DOC] as const

export const COMMUNITY_THREADS = [
  { title: 'Posts', slug: THREAD_PATH.POST, index: 0 },
  { title: 'Blogs', slug: THREAD_PATH.BLOG, index: 1 },
  { title: 'Kanban', slug: THREAD_PATH.KANBAN, index: 2 },
  { title: 'Changelog', slug: THREAD_PATH.CHANGELOG, index: 3 },
  { title: 'Docs', slug: THREAD_PATH.DOC, index: 4 },
  { title: 'About', slug: THREAD_PATH.ABOUT, index: 5 },
] as const
