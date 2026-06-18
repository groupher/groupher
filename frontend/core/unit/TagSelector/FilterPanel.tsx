import { keys } from 'ramda'
import type { FC } from 'react'

import { createKeyboardClick } from '~/lib/a11y'
import type { TColorName, TGroupedTags, TTag } from '~/spec'
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
          <div
            className={s.selectItem}
            key={tag.id}
            role='button'
            tabIndex={0}
            onClick={() => onSelect(tag)}
            onKeyDown={createKeyboardClick(() => onSelect(tag))}
          >
            <TagNode color={tag.color as TColorName} marker={tag.marker} boldHash />
            <div className={s.title}>{tag.title}</div>
          </div>
        )
      })}
    </div>
  )
}

const FilterPanel: FC<TProps> = ({ groupedTags, activeTag, onSelect }) => {
  const s = useSalon()
  const groupTitles = keys(groupedTags) as string[]

  return (
    <div className={s.wrapper}>
      {groupTitles.map((title) => {
        return (
          <div key={title}>
            <div className={s.groupTitle}>{title}</div>
            <GroupTags tags={groupedTags[title]} onSelect={onSelect} activeTag={activeTag} />
          </div>
        )
      })}
    </div>
  )
}

export default FilterPanel
