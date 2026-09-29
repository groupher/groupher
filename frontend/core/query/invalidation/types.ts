import type { TThread } from '~/spec'

import type { TArticlePath } from '../articlePath'

export type TArticleListScope = {
  community: string
  thread?: TThread
}

export type TQueryInvalidationTarget =
  | { domain: 'article'; target: 'stats'; path: TArticlePath }
  | { domain: 'article'; target: 'stats-batch'; community: string; thread: TThread }
  | { domain: 'article'; target: 'content'; path: TArticlePath }
  | { domain: 'article'; target: 'lists'; scope: TArticleListScope }
  | { domain: 'article'; target: 'tag-groups'; community: string; thread: TThread }
  | { domain: 'comment'; target: 'list'; path: TArticlePath }
  | { domain: 'community'; target: 'config'; community: string }
  | { domain: 'community'; target: 'dashboard'; community: string }
  | { domain: 'community'; target: 'wallpaper'; community: string }
  | { domain: 'community'; target: 'wallpaper-editor'; community: string }
  | { domain: 'community'; target: 'press-config'; community: string }
  | { domain: 'viewer'; target: 'article-state'; accountRef: string }
  | { domain: 'viewer'; target: 'comment-state'; accountRef: string; articleKey: string }

export type TQueryMatch = {
  domain: TQueryInvalidationTarget['domain']
  target: TQueryInvalidationTarget['target']
  matches: (queryKey: readonly unknown[]) => boolean
}

export type TQueryInvalidationPlan = {
  matches: readonly TQueryMatch[]
  refetch: 'active' | 'none'
}

export type TQueryInvalidationFailure = {
  domain: string
  target: string
  reason: 'resolver' | 'executor'
}

export type TQueryInvalidationResult = {
  matched: number
  deduped: number
  refetched: number
  markedStale: number
  failures: readonly TQueryInvalidationFailure[]
}
