export type TArticleThread =
  | 'post'
  // for groupher
  | 'changelog'
  | 'kanban'
  | 'doc'
  | 'about'

export type TThread = TArticleThread | 'dashboard' | 'kanban' | 'team' | 'account'

export type TCommunityThread = {
  title: string
  slug: TThread
  index?: number
}
