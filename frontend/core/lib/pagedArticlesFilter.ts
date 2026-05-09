import { mergeRight, reject } from 'ramda'

import URL_PARAM from '~/const/url_param'
import type { TPagedArticlesParams } from '~/spec'
import { nilOrEmpty } from '~/validator'

type TSearchParamsLike = {
  get: (key: string) => string | null
  toString?: () => string
}

type TSearchParamsObject = Record<string, string | string[] | undefined>

const ARTICLES_FILTER = {
  page: 1,
  size: 20,
}

const normalizeEnumValue = (value: string | null): string | null => {
  if (!value) return null
  return value.toUpperCase()
}

const isSearchParamsLike = (
  source: TSearchParamsLike | TSearchParamsObject,
): source is TSearchParamsLike => typeof (source as TSearchParamsLike).get === 'function'

export const toURLSearchParams = (
  source?: TSearchParamsLike | TSearchParamsObject | null,
): URLSearchParams => {
  if (!source) return new URLSearchParams()
  if (isSearchParamsLike(source)) {
    return new URLSearchParams(source.toString?.() || '')
  }

  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      if (value[0]) searchParams.set(key, value[0])
      continue
    }

    if (value) searchParams.set(key, value)
  }

  return searchParams
}

export const getPagedArticlesParams = (
  community: string,
  source?: TSearchParamsLike | TSearchParamsObject | null,
): TPagedArticlesParams => {
  const searchParams = toURLSearchParams(source)

  const filter = reject(nilOrEmpty)({
    community,
    page: Number(searchParams.get(URL_PARAM.PAGE)) || 1,
    communityTag: searchParams.get(URL_PARAM.TAG),
    cat: normalizeEnumValue(searchParams.get(URL_PARAM.CAT)),
    status: normalizeEnumValue(searchParams.get(URL_PARAM.STATUS)),
    order: normalizeEnumValue(searchParams.get(URL_PARAM.ORDER)),
  })

  return mergeRight(ARTICLES_FILTER, filter) as TPagedArticlesParams
}
