export const ARTICLE_THREAD = {
  POST: 'post',
  BLOG: 'blog',
  CHANGELOG: 'changelog',
  DOC: 'doc',
  KANBAN: 'kanban',
} as const

export const KANBAN_BOARD = {
  BACKLOG: 'backlog',
  TODO: 'todo',
  WIP: 'wip',
  DONE: 'done',
  REJECTED: 'rejected',
} as const

export const THREAD = {
  ...ARTICLE_THREAD,
  ACCOUNT: 'account',
  // for groupher

  ABOUT: 'about',
  DASHBOARD: 'dashboard',
} as const
