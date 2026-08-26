import { useContext } from 'react'

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
import { ShellStyleContext } from '~/stores/shellStyle/context'

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
  const value = useContext(ShellStyleContext)
  if (!value) throw new Error('useLayout must be used within ShellStyleProvider')

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
  } = value

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
