'use client'

/*
 * TagsBar
 */

import { keys, reverse } from 'ramda'
import type { FC } from 'react'

import Folder from './Folder'
import GoBackTag from './GobackTag'
import useSalon from './salon'
import useLogic from './useLogic'

type TProps = {
  onSelect?: () => void
}

const TagsBar: FC<TProps> = ({ onSelect }) => {
  const s = useSalon()

  const { tags, activeTag, maxDisplayCount, totalCountThreshold, groupedTags, onTagSelect } =
    useLogic()

  const groupsKeys = reverse(keys(groupedTags)) as string[]

  return (
    <div className={s.wrapper}>
      {activeTag?.title && (
        <GoBackTag
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
          totalCountThreshold={totalCountThreshold}
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
