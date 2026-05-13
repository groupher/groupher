import { useMemo, useState } from 'react'

import { THREAD } from '~/const/thread'
import type { TThread } from '~/spec'

import type { TDraftGroup } from './types'

type TRet = {
  draftGroups: readonly TDraftGroup[]
  visibleDraftGroups: readonly TDraftGroup[]
  createDraftGroup: (thread?: TThread | null) => void
  renameDraftGroup: (draftId: string, toGroup: string) => void
  removeDraftGroup: (draftId: string) => void
  completeDraftGroup: (draftId?: string) => void
}

// Draft groups exist only while the inline title editor is open. Once the title
// is confirmed, the real group is persisted and this local row is removed.
export default function useDraftTag(activeThread?: TThread | null): TRet {
  const [draftGroups, setDraftGroups] = useState<TDraftGroup[]>([])
  const currentThread = activeThread || THREAD.POST

  // Draft groups are scoped by thread because each community section has its own
  // tag list. Keeping them local avoids leaking unsaved draft UI into the global
  // dashboard store or across section switches.
  const visibleDraftGroups = useMemo(
    () => draftGroups.filter((group) => group.thread === currentThread),
    [currentThread, draftGroups],
  )

  // New drafts always start with an empty title. GroupBlock treats that as
  // "rename mode" and asks the user for the group name before showing the first
  // tag creator under it.
  const createDraftGroup = (thread: TThread | null = currentThread): void => {
    setDraftGroups((groups) => [
      {
        id: `${Date.now()}`,
        title: '',
        thread: thread || THREAD.POST,
      },
      ...groups,
    ])
  }

  const renameDraftGroup = (draftId: string, toGroup: string): void => {
    setDraftGroups((groups) =>
      groups.map((group) => (group.id === draftId ? { ...group, title: toGroup } : group)),
    )
  }

  const removeDraftGroup = (draftId: string): void => {
    setDraftGroups((groups) => groups.filter((item) => item.id !== draftId))
  }

  // Completing means the real backend group was saved successfully.
  const completeDraftGroup = (draftId?: string): void => {
    if (!draftId) return
    removeDraftGroup(draftId)
  }

  return {
    draftGroups,
    visibleDraftGroups,
    createDraftGroup,
    renameDraftGroup,
    removeDraftGroup,
    completeDraftGroup,
  }
}
