import { SEARCH_PARAM } from '~/constant/url'
import URL_PARAM from '~/constant/url_param'
import type { TPagedPosts } from '~/spec'

type TFetchPagedPostsParams = {
  community: string
  page?: number
  tag?: string | null
  cat?: string | null
  state?: string | null
  order?: string | null
}

const buildSearchParams = ({
  community,
  page,
  tag,
  cat,
  state,
  order,
}: TFetchPagedPostsParams): URLSearchParams => {
  const searchParams = new URLSearchParams()

  searchParams.set(SEARCH_PARAM.COMMUNITY, community)

  if ((page || 1) > 1) searchParams.set(URL_PARAM.PAGE, String(page))
  if (tag) searchParams.set(URL_PARAM.TAG, tag)
  if (cat) searchParams.set(URL_PARAM.CAT, cat)
  if (state) searchParams.set(URL_PARAM.STATE, state)
  if (order) searchParams.set(URL_PARAM.ORDER, order)

  return searchParams
}

const fetchPagedPosts = async (params: TFetchPagedPostsParams): Promise<TPagedPosts | null> => {
  const response = await fetch(`/api/posts?${buildSearchParams(params).toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`failed to fetch paged posts: ${response.status}`)
  }

  return (await response.json()) as TPagedPosts | null
}

export default fetchPagedPosts
