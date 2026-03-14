import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type {
  TAvatarLayout,
  TBannerLayout,
  TBrandLayout,
  TChangelogLayout,
  TKanbanCardLayout,
  TKanbanLayout,
  TPostLayout,
  TTagLayout,
} from '~/spec'

type TRet = {
  avatarLayout: TAvatarLayout
  bannerLayout: TBannerLayout
  brandLayout: TBrandLayout
  tagLayout: TTagLayout
  postLayout: TPostLayout
  kanbanLayout: TKanbanLayout
  kanbanCardLayout: TKanbanCardLayout
  changelogLayout: TChangelogLayout
}

export default function UseLayout(): TRet {
  const dashboard = useDashboard()

  return pick(
    [
      'avatarLayout',
      'bannerLayout',
      'brandLayout',
      'tagLayout',
      'postLayout',
      'kanbanLayout',
      'kanbanCardLayout',
      'changelogLayout',
    ],
    dashboard,
  )
}
