import type { TThread } from '~/spec'

import { SEARCH_PARAM } from '~/const/url'

import { fetchAPI } from '~/utils/api'
import { plural } from '~/fmt'

export const fetchArticlePageData = async (community: string, thread: TThread) => {
  return Promise.all([
    fetchAPI(`/${plural(thread)}?${SEARCH_PARAM.COMMUNITY}=${community}`),
    fetchAPI(`/tags?${SEARCH_PARAM.COMMUNITY}=${community}&${SEARCH_PARAM.THREAD}=${thread}`),
  ])
}
