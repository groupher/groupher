import { pick } from 'ramda'
import type {
  TAvatarLayout,
  TBannerLayout,
  TBrandLayout,
  TChangelogLayout,
  TInlineTagLayout,
  TKanbanCardLayout,
  TKanbanLayout,
  TPostLayout,
  TTagLayout,
} from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

type TRet = {
  avatarLayout: TAvatarLayout
  bannerLayout: TBannerLayout
  brandLayout: TBrandLayout
  tagLayout: TTagLayout
  inlineTagLayout: TInlineTagLayout
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
      'inlineTagLayout',
      'postLayout',
      'kanbanLayout',
      'kanbanCardLayout',
      'changelogLayout',
    ],
    dashboard,
  )
}
