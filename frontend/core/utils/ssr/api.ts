import { SEARCH_PARAM } from '~/const/url'
import { plural } from '~/fmt'
import type { TThread } from '~/spec'
import { fetchAPI } from '~/utils/api'

export const fetchArticlePageData = async (community: string, thread: TThread) => {
  return Promise.all([
    fetchAPI(`/${plural(thread)}?${SEARCH_PARAM.COMMUNITY}=${community}`),
    fetchAPI(`/tags?${SEARCH_PARAM.COMMUNITY}=${community}&${SEARCH_PARAM.THREAD}=${thread}`),
  ])
}
