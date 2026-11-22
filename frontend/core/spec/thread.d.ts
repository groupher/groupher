import type { THREAD_PATH } from '~/const/thread'
import type { ArticleThread, Thread } from '~/lib/graphql/generated/enums'
import type { TConstValues } from '~/spec'

export type TArticleThread = ArticleThread

export type TThread = Exclude<Thread, 'USER'>
export type TThreadPath = TConstValues<typeof THREAD_PATH>

export type TCommunityThread = {
  title: string
  slug: TThreadPath
  index?: number
}
