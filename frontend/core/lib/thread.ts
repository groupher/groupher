import { ARTICLE_THREAD } from '~/const/thread'
import type { TThread } from '~/spec'

export type TGqlThreadScope = 'ALL' | 'TAGS'

const TAGS_THREAD_SET = new Set(
  Object.values(ARTICLE_THREAD).filter((t) => t !== ARTICLE_THREAD.KANBAN),
)

export const toGqlThread = (thread: TThread, scope: TGqlThreadScope = 'ALL'): string | null => {
  // @ts-expect-error
  if (scope === 'TAGS' && !TAGS_THREAD_SET.has(thread)) return null

  return thread.toUpperCase()
}
