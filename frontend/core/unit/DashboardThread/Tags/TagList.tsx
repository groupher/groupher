import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useMemo } from 'react'

import { THREAD } from '~/const/thread'
import useMount from '~/hooks/useMount'
import type { TTag } from '~/spec'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import useTags from '../logic/useTags'
import GroupBlock from './GroupBlock'
import type { TDraftGroup, TGroupListItem } from './types'

const UNGROUPED_GROUP = 'Ungrouped'

type TProps = {
  draftGroups: readonly TDraftGroup[]
  onRemoveDraft: (draftId: string) => void
  onRenameDraft: (draftId: string, toGroup: string) => void
  onCompleteDraft: (draftId?: string) => void
  onSettingTag: (tag: TTag) => void
}

export default function TagList({
  draftGroups,
  onRemoveDraft,
  onRenameDraft,
  onCompleteDraft,
  onSettingTag,
}: TProps) {
  const { activeTagThread, loading, loadTags, tags } = useTags()
  const [animateRef] = useAutoAnimate()

  useMount(loadTags)
  const currentThread = activeTagThread || THREAD.POST

  const groupedTags = useMemo(() => {
    const groups = new Map<string, TTag[]>()

    for (const tag of tags) {
      const group = tag.group || UNGROUPED_GROUP
      groups.set(group, [...(groups.get(group) || []), tag])
    }

    return groups
  }, [tags])

  const groups = useMemo(() => {
    const realGroups: TGroupListItem[] = Array.from(groupedTags.keys()).map((group) => ({
      key: group,
      title: group,
      tags: groupedTags.get(group) || [],
      draft: false,
    }))

    const draftItems: TGroupListItem[] = draftGroups
      .filter((group) => group.thread === currentThread)
      .map((group) => ({
        key: group.id,
        title: group.title,
        tags: [],
        draft: true,
        draftId: group.id,
      }))

    const draftTitles = new Set(draftItems.map((group) => group.title).filter(Boolean))

    return [...draftItems, ...realGroups.filter((group) => !draftTitles.has(group.title))]
  }, [currentThread, draftGroups, groupedTags])

  return (
    <div ref={animateRef}>
      {loading && <LavaLampLoading bottom={10} />}

      {groups.map((group) => (
        <GroupBlock
          key={group.key}
          title={group.title}
          tags={group.tags}
          draft={group.draft}
          draftId={group.draftId}
          activeThread={currentThread}
          groupNames={groups.map((item) => item.title).filter(Boolean)}
          onRemoveDraft={onRemoveDraft}
          onRenameDraft={onRenameDraft}
          onCompleteDraft={onCompleteDraft}
          onSettingTag={onSettingTag}
        />
      ))}
    </div>
  )
}
