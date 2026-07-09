export type TArticleTocItem = {
  id: string
  title: string
  level: 2 | 3
}

export type TArticleTocSelectHandler = (item: TArticleTocItem) => void
