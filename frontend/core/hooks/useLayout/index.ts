import { pick } from 'ramda'
import type {
  TAvatarLayout,
  TBrandLayout,
  TChangelogLayout,
  TCommunityLayout,
  TInlineTagLayout,
  TKanbanBoard,
  TKanbanCardLayout,
  TKanbanLayout,
  TPostLayout,
  TTagLayout,
} from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

type TRet = {
  avatarLayout: TAvatarLayout
  communityLayout: TCommunityLayout
  brandLayout: TBrandLayout
  tagLayout: TTagLayout
  inlineTagLayout: TInlineTagLayout
  postLayout: TPostLayout
  kanbanLayout: TKanbanLayout
  kanbanCardLayout: TKanbanCardLayout
  kanbanBoards: readonly TKanbanBoard[]
  changelogLayout: TChangelogLayout
}

export default function UseLayout(): TRet {
  const dashboard = useDashboard()

  return pick(
    [
      'avatarLayout',
      'communityLayout',
      'brandLayout',
      'tagLayout',
      'inlineTagLayout',
      'postLayout',
      'kanbanLayout',
      'kanbanCardLayout',
      'kanbanBoards',
      'changelogLayout',
    ],
    dashboard,
  )
}
