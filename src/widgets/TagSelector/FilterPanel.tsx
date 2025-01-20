import type { FC } from 'react'
import { keys } from 'ramda'

import type { TTag, TGroupedTags, TColorName } from '~/spec'
import TagNode from '~/widgets/TagNode'

import useSalon from './salon/filter_panel'

type TProps = {
  activeTag: TTag
  groupedTags: TGroupedTags
  onSelect: (tag: TTag) => void
}

type TGroupTags = {
  tags: TTag[]
  activeTag
  onSelect: (tag: TTag) => void
}
const GroupTags: FC<TGroupTags> = ({ tags, activeTag, onSelect }) => {
  const s = useSalon()

  return (
    <div className={s.group}>
      {tags.map((tag) => {
        console.log('## active Tag: ', activeTag)
        // const $active = tag.id === activeTag?.id
        return (
          <div className={s.selectItem} key={tag.id} onClick={() => onSelect(tag)}>
            <TagNode color={tag.color as TColorName} boldHash />
            <div className={s.title}>{tag.title}</div>
          </div>
        )
      })}
    </div>
  )
}

const FilterPanel: FC<TProps> = ({ groupedTags, activeTag, onSelect }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {keys(groupedTags).map((title) => {
        return (
          <div key={title as string}>
            <div className={s.groupTitle}>{title}</div>
            <GroupTags
              tags={groupedTags[title as string]}
              onSelect={onSelect}
              activeTag={activeTag}
            />
          </div>
        )
      })}
    </div>
  )
}

export default FilterPanel
