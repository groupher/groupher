import type { TAPIMode } from './spec'

export enum MODE {
  TIMELINE = 'TIMELINE',
  REPLIES = 'REPLIES',
}

export const API_MODE = {
  ARTICLE: 'article' as TAPIMode,
  USER_PUBLISHED: 'user_published' as TAPIMode,
}

export enum EDIT_MODE {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  REPLY = 'REPLY',
}
