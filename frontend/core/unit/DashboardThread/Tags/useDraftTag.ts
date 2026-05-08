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

// A tag group is not a persisted backend entity. The backend only stores a
// string group name on each tag, so an empty group has no durable representation.
// This hook keeps that "new group before first tag exists" state local to the
// tag editor and removes it once the first tag has been created.
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

  // Completing means the first real tag was saved successfully. At that point
  // the group is represented by the saved tag.group value and the draft row is
  // no longer needed.
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
