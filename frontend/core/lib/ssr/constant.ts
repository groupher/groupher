import { HOME_COMMUNITY } from '~/const/name'
import { THREAD } from '~/const/thread'
import { toGqlThread } from '~/utils/thread'

import type { TRequestPolicy } from './spec'

export const GQ_OPTION = {
  skip: false,
  requestPolicy: 'cache-first' as TRequestPolicy,
  userHasLogin: false,
}

export const TAGS_FILTER = {
  community: HOME_COMMUNITY.slug,
  thread: toGqlThread(THREAD.POST, 'TAGS') || THREAD.POST.toUpperCase(),
}

export const ARTICLES_FILTER = {
  community: HOME_COMMUNITY.slug,
  page: 1,
  size: 20,
}
