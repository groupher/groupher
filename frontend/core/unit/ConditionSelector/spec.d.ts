import type { TArticleStatus, TArticleCat, TMenu, TArticleSort } from '~/spec'

export type TActiveCondition = TArticleStatus | TArticleCat | TArticleSort | null

export type TMenuItem = {
  key: string
  title?: stirng
  icon?: TMenu
}
