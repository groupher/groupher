import type { TThread } from '~/spec'

const communityCache = (community: string): string => {
  return `community[${community}]`
}

const tagsCache = (community: string, thread: TThread): string => {
  return `community[${community}]-thread[${thread}]-tags`
}

const articlesCache = (community: string, thread: TThread): string => {
  return `community[${community}]-thread[${thread}]-articles`
}

const articleCache = (community: string, thread: TThread, innerId: string | number): string => {
  return `community[${community}]-thread[${thread}]-article[${innerId}]`
}

const commentsCache = (community: string, thread: TThread, innerId: string | number): string => {
  return `community[${community}]-thread[${thread}]-article[${innerId}]-comments`
}

const docTreeCache = (community: string): string => `community[${community}]-doc-tree`

export const CACHE_TAG = {
  communityCache,
  tagsCache,
  articlesCache,
  articleCache,
  commentsCache,
  docTreeCache,
}
