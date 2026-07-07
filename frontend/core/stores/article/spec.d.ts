import type { TChangelog, TDoc, TMetric, TPost, TTag, TThread } from '~/spec'

export type TInit = {
  metric?: TMetric
  thread?: TThread | null
  post?: TPost
  changelog?: TChangelog
  doc?: TDoc

  tags?: TTag[]

  isArticleLayout?: boolean
  isFAQArticleLayout?: boolean
}

export type TStore = TInit & {
  article: TPost | TChangelog | TDoc | null
  commit: (patch: Partial<TStore>) => void
}
