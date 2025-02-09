import type { TArticleThread, TThread } from '~/spec'

export const CARD_THREAD = {}

export const ARTICLE_THREAD = {
  POST: 'post',
  CHANGELOG: 'changelog',
} as Record<Uppercase<TArticleThread>, TArticleThread>

export const THREAD = {
  ...ARTICLE_THREAD,
  ACCOUNT: 'account',
  // for groupher
  KANBAN: 'kanban',
  CHANGELOG: 'changelog',
  DOC: 'doc',
  ABOUT: 'about',
  DASHBOARD: 'dashboard',
} as Record<Uppercase<TThread>, TThread>

export const USER_THREAD = {
  PROFILE: 'profile',
  PUBLISH: 'publish',
  COMMENTS: 'comments',
  FAVORITES: 'favorites',
  LINKS: 'likes',
  BILLING: 'billing',
  SETTINGS: 'settings',
}
