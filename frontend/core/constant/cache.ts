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

export const CACHE_TAG = {
  communityCache,
  tagsCache,
  articlesCache,
}
