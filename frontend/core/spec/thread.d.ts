import type { ARTICLE_THREAD, THREAD, THREAD_PATH } from '~/const/thread'
import type { TConstValues } from '~/spec'

export type TArticleThread = TConstValues<typeof ARTICLE_THREAD>

export type TThread = TConstValues<typeof THREAD>
export type TThreadPath = TConstValues<typeof THREAD_PATH>

export type TCommunityThread = {
  title: string
  slug: TThreadPath
  index?: number
}
