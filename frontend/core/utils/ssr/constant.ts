import { THREAD } from '~/const/thread'
import { HCN } from '~/const/name'

import type { TRequestPolicy } from './spec'

export const GQ_OPTION = {
  skip: false,
  requestPolicy: 'cache-first' as TRequestPolicy,
  userHasLogin: false,
}

export const TAGS_FILTER = {
  community: HCN,
  thread: THREAD.POST.toUpperCase(),
}

export const ARTICLES_FILTER = {
  community: HCN,
  page: 1,
  size: 20,
}
