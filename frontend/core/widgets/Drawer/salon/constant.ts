import { concat, keys, reduce } from 'ramda'
import { ARTICLE_THREAD } from '~/const/thread'
import TYPE from '~/const/type'

export const NARROW_HEIGHT_OFFSET = 25
export const CLOSE_ANIMATION_MS = 150

export const ARTICLE_VIEWER_TYPES = reduce(
  concat,
  [],
  keys(ARTICLE_THREAD).map((T) => [TYPE.DRAWER[`${T}_VIEW`]]),
)

export const ARTICLE_THREAD_CURD_TYPES = reduce(
  concat,
  [...ARTICLE_VIEWER_TYPES],
  keys(ARTICLE_THREAD).map((T) => [TYPE.DRAWER[`${T}_CREATE`], TYPE.DRAWER[`${T}_EDIT`]]),
)
