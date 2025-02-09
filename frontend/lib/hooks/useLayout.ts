import { pick } from 'ramda'

import type {
  TAvatarLayout,
  TBannerLayout,
  TBrandLayout,
  TChangelogLayout,
  TKanbanLayout,
  TPostLayout,
  TTagLayout,
  TKanbanCardLayout,
} from '~/spec'
import useSubStore from '~/hooks/useSubStore'

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

export default (): TRet => {
  const store = useSubStore('dashboard')

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
    store,
  )
}
