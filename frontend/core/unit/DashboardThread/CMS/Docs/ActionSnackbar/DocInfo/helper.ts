import type { TDocDraftAuthor } from '../../Editor/store/spec'
import { DOC_INFO_EMPTY } from '../constant'

export const formatDocInfoDate = (value?: string | null): string => {
  if (!value) return DOC_INFO_EMPTY

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return DOC_INFO_EMPTY

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(date)
    .replace(',', '')
}

export const getDocInfoAuthorName = (author?: TDocDraftAuthor | null): string =>
  author?.nickname || author?.login || ''

export const formatDocInfoSlug = (slug?: string | null): string => {
  if (!slug) return DOC_INFO_EMPTY

  return slug.startsWith('/') ? slug : `/${slug}`
}
