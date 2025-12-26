import type { TChangelog, TMetric, TPost, TTag, TThread } from '~/spec'

export type TInit = {
  metric?: TMetric
  thread?: TThread | null
  post?: TPost
  changelog?: TChangelog

  tags?: TTag[]

  isArticleLayout?: boolean
  isFAQArticleLayout?: boolean
}

export type TStore = TInit & {
  article: TPost | TChangelog | null
  commit: (patch: Partial<TStore>) => void
}
