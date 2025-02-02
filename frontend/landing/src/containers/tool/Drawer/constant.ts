import { concat, keys, reduce } from 'ramda'

import TYPE from '~/const/type'
import { ARTICLE_THREAD } from '~/const/thread'

export const NARROW_HEIGHT_OFFSET = 25

export const ARTICLE_VIEWER_TYPES = reduce(
  concat,
  // @ts-ignore
  [],
  keys(ARTICLE_THREAD).map((T) => [TYPE.DRAWER[`${T}_VIEW`]]),
)

export const ARTICLE_THREAD_CURD_TYPES = reduce(
  concat,
  // @ts-ignore
  [...ARTICLE_VIEWER_TYPES],
  keys(ARTICLE_THREAD).map((T) => [TYPE.DRAWER[`${T}_CREATE`], TYPE.DRAWER[`${T}_EDIT`]]),
)
