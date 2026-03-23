import type { TAPIMode, TMode } from './spec'

export const MODE = {
  TIMELINE: 'TIMELINE' as TMode,
  REPLIES: 'REPLIES' as TMode,
}

export const API_MODE = {
  ARTICLE: 'article' as TAPIMode,
  USER_PUBLISHED: 'user_published' as TAPIMode,
}
