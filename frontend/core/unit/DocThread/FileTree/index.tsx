/*
 *
 * FileTree
 *
 */

import { keys, reverse } from 'ramda'
import { type FC, memo } from 'react'

import { groupByKey } from '~/helper'
import { mockTags } from '~/mock'
import type { TSpace } from '~/spec'

import Folder from './Folder'
import useSalon from './salon'

type TProps = {
  onSelect?: () => void
} & TSpace

const FileTree: FC<TProps> = ({ onSelect, ...spacing }) => {
  const s = useSalon({ ...spacing })

  const tagsData = mockTags(15)
  // console.log('## ## tagsData: ', tagsData)

  const activeTagData = tagsData[6]
  const groupedTags = groupByKey(tagsData, 'group')
  const groupsKeys = reverse(keys(groupedTags)) as string[]

  return (
    <div className={s.wrapper}>
      {groupsKeys.map((groupKey) => (
        <Folder
          key={groupKey}
          title={groupKey}
          groupTags={groupedTags[groupKey]}
          allTags={tagsData}
          activeTag={activeTagData}
          maxDisplayCount={3}
          totalCountThreshold={10}
          onSelect={() => {
            // onTagSelect(tag)
            onSelect?.()
          }}
        />
      ))}
    </div>
  )
}

export default memo(FileTree)
