export type TInit = {
  isFAQArticleLayout?: boolean
}

export type TStore = TInit & {
  commit: (patch: Partial<TStore>) => void
}
