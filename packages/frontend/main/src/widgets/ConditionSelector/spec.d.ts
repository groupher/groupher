import type { TArticleState, TArticleCat, TMenu, TArticleSort } from '~/spec'

export type TActiveCondition = TArticleState | TArticleCat | TArticleSort | null

export type TMenuItem = {
  key: string
  title?: stirng
  icon?: TMenu
}
