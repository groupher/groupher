import type { ARTICLE_THREAD, THREAD } from '~/const/thread'
import type { TConstValues } from '~/spec'

export type TArticleThread = TConstValues<typeof ARTICLE_THREAD>

export type TThread = TConstValues<typeof THREAD>

export type TCommunityThread = {
  title: string
  slug: TThread
  index?: number
}
