export const CARD_THREAD = {}

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

export const USER_THREAD = {
  PROFILE: 'profile',
  PUBLISH: 'publish',
  COMMENTS: 'comments',
  FAVORITES: 'favorites',
  LINKS: 'likes',
  BILLING: 'billing',
  SETTINGS: 'settings',
}
