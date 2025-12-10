'use client'

/*
 * TagsBar
 */

import { keys, reverse } from 'ramda'
import { type FC, useEffect } from 'react'
import Folder from './Folder'
import GobackTag from './GobackTag'
import useSalon from './salon'
import useLogic from './useLogic'

type TProps = {
  onSelect: () => void
}

const TagsBar: FC<TProps> = ({ onSelect }) => {
  const s = useSalon()

  const {
    tags,
    activeTag,
    maxDisplayCount,
    totalCountThrold,
    getGroupedTags,
    onTagSelect,
    syncActiveTagFromURL,
  } = useLogic()

  useEffect(() => {
    syncActiveTagFromURL()
  }, [syncActiveTagFromURL])

  const groupedTags = getGroupedTags()
  const groupsKeys = reverse(keys(groupedTags)) as string[]

  return (
    <div className={s.wrapper}>
      {activeTag?.title && (
        <GobackTag
          onSelect={(tag) => {
            onTagSelect(tag)
            onSelect?.()
          }}
        />
      )}
      {groupsKeys.map((groupKey) => (
        <Folder
          key={groupKey}
          title={groupKey}
          groupTags={groupedTags[groupKey]}
          allTags={tags}
          activeTag={activeTag}
          maxDisplayCount={maxDisplayCount}
          totalCountThrold={totalCountThrold}
          onSelect={(tag) => {
            onTagSelect(tag)
            onSelect?.()
          }}
        />
      ))}
    </div>
  )
}

export default TagsBar
