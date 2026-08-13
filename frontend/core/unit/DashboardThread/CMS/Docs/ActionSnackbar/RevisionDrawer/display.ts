import type { TTransKey } from '~/spec'

import { REVISION_LABEL_KEY } from '../constant'
import type { TArticleSnapshotAuthor } from './spec'

type TTranslate = (key: TTransKey) => string

/** Returns revision author name for the frontend shared workflow. */
export const getRevisionAuthorName = (
  t: TTranslate,
  author?: TArticleSnapshotAuthor | null,
): string => author?.nickname || author?.login || t(REVISION_LABEL_KEY.UNKNOWN_AUTHOR)

/** Returns revision author initial for the frontend shared workflow. */
export const getRevisionAuthorInitial = (author?: TArticleSnapshotAuthor | null): string =>
  (author?.nickname || author?.login || '').trim().charAt(0).toUpperCase() || '?'

/** Runs the format relative revision time operation at the frontend shared boundary. */
export const formatRelativeRevisionTime = (t: TTranslate, datetime?: string | null): string => {
  if (!datetime) return t(REVISION_LABEL_KEY.UNKNOWN_TIME)

  const timestamp = new Date(datetime).getTime()
  if (Number.isNaN(timestamp)) return t(REVISION_LABEL_KEY.UNKNOWN_TIME)

  const seconds = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0)
  if (seconds < 60) return t(REVISION_LABEL_KEY.JUST_NOW)

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} ${t(REVISION_LABEL_KEY.MIN_AGO)}`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${t(REVISION_LABEL_KEY.HR_AGO)}`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ${t(REVISION_LABEL_KEY.DAY_AGO)}`

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp))
}
