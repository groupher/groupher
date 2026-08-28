import type {
  TAvatarLayout,
  TBrandLayout,
  TChangelogLayout,
  TCommunityLayout,
  TInlineTagLayout,
  TKanbanBoard,
  TKanbanCardLayout,
  TKanbanLayout,
  TNavActiveLayout,
  TPostLayout,
  TTagLayout,
} from '~/spec'
import useDsb from '~/stores/dsb/hooks'

type TRet = {
  avatarLayout: TAvatarLayout
  communityLayout: TCommunityLayout
  brandLayout: TBrandLayout
  tagLayout: TTagLayout
  inlineTagLayout: TInlineTagLayout
  navActiveLayout: TNavActiveLayout
  postLayout: TPostLayout
  kanbanLayout: TKanbanLayout
  kanbanCardLayout: TKanbanCardLayout
  kanbanBoards: readonly TKanbanBoard[]
  changelogLayout: TChangelogLayout
}

export default function UseLayout(): TRet {
  const {
    avatarLayout,
    communityLayout,
    brandLayout,
    tagLayout,
    inlineTagLayout,
    navActiveLayout,
    postLayout,
    kanbanLayout,
    kanbanCardLayout,
    kanbanBoards,
    changelogLayout,
  } = useDsb()

  return {
    avatarLayout,
    communityLayout,
    brandLayout,
    tagLayout,
    inlineTagLayout,
    navActiveLayout,
    postLayout,
    kanbanLayout,
    kanbanCardLayout,
    kanbanBoards,
    changelogLayout,
  }
}
