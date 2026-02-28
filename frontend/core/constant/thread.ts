export const ARTICLE_THREAD = {
  POST: 'post',
  CHANGELOG: 'changelog',
  ABOUT: 'about',
} as const

export const THREAD = {
  ...ARTICLE_THREAD,
  ACCOUNT: 'account',
  // for groupher
  KANBAN: 'kanban',
  CHANGELOG: 'changelog',
  DOC: 'doc',
  DASHBOARD: 'dashboard',
} as const

