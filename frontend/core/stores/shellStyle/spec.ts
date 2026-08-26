import type {
  TAvatarLayout,
  TBrandLayout,
  TChangelogLayout,
  TColorName,
  TCommunityLayout,
  TInlineTagLayout,
  TKanbanBoard,
  TKanbanCardLayout,
  TKanbanLayout,
  TMetric,
  TNameAlias,
  TNavActiveLayout,
  TPostLayout,
  TTagLayout,
} from '~/spec'

export type TShellStyle = {
  avatarLayout: TAvatarLayout
  brandLayout: TBrandLayout
  changelogLayout: TChangelogLayout
  communityLayout: TCommunityLayout
  inlineTagLayout: TInlineTagLayout
  kanbanBgColors: readonly TColorName[]
  kanbanBoards: readonly TKanbanBoard[]
  kanbanCardLayout: TKanbanCardLayout
  kanbanLayout: TKanbanLayout
  metric: TMetric
  nameAlias: readonly TNameAlias[]
  navActiveLayout: TNavActiveLayout
  overlayDark: boolean
  postLayout: TPostLayout
  tagLayout: TTagLayout
}
