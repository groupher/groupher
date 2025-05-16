export type TArticleListThread = 'post' | 'changelog' | 'kanban' | 'doc'
export type TArticleThread = TArticleListThread | 'about'

export type TThread = TArticleThread | 'dashboard' | 'kanban' | 'team' | 'account'

export type TCommunityThread = {
  title: string
  slug: TThread
  index?: number
}
