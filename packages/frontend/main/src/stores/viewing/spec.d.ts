import type { TCommunity, TUser, TPost, TChangelog, TThread, TArticle, TMetric, TTag } from '~/spec'

export type TInit = {
  metric?: TMetric
  community?: TCommunity
  user?: TUser
  post?: TPost
  changelog?: TChangelog
  thread?: TThread
  viewingThread?: TThread
  activeThread?: TThread

  isArticleLayout?: boolean
  isFAQArticleLayout?: boolean

  tags?: TTag[]
  activeTag?: TTag | null
}

export type TStore = TInit & {
  // views
  communityDigestInView: boolean

  // actions
  updateViewingCommunity: (args: TCommunity) => void
  commit: (patch: Partial<TStore>) => void
}
