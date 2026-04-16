import { pick } from 'ramda'
import type {
  TAvatarLayout,
  TGlobalLayout,
  TBrandLayout,
  TChangelogLayout,
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
  globalLayout: TGlobalLayout
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
      'globalLayout',
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
