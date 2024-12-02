import { type FC, useState, useRef, useEffect } from 'react'
import { findIndex, reverse } from 'ramda'

import type { TTag } from '~/spec'
import { sortByColor } from '~/helper'

import ArrowSVG from '~/icons/ArrowSimple'
import FileItem from './FileItem'

import useSalon from './salon/folder'

type TProps = {
  title: string
  allTags: TTag[]
  activeTag: TTag
  groupTags: TTag[]
  maxDisplayCount: number
  totalCountThrold: number

  onSelect: (tag?: TTag) => void
}

const Folder: FC<TProps> = ({
  title,
  groupTags,
  allTags,
  activeTag,
  maxDisplayCount,
  totalCountThrold,
  onSelect,
}) => {
  // 决定是否显示 '展示更多' 的时候参考标签总数
  const needSubToggle = allTags?.length > totalCountThrold && groupTags.length > maxDisplayCount

  const initDisplayCount = needSubToggle ? maxDisplayCount : groupTags.length

  const [isFolderOpen, toggleFolder] = useState(true)
  const [curDisplayCount, setCurDisplayCount] = useState(initDisplayCount)

  const s = useSalon({ show: title !== null, isFolderOpen })

  const sortedTags = reverse(sortByColor(groupTags))

  // @ts-ignore
  const isActiveTagInFolder = findIndex((item) => item.id === activeTag.id, groupTags) >= 0

  const subToggleRef = useRef(null)
  // 当选中的 Tag 被折叠在展示更多里面时，将其展开
  useEffect(() => {
    if (subToggleRef && isActiveTagInFolder) {
      setCurDisplayCount(groupTags.length)
    }
  }, [subToggleRef, isActiveTagInFolder, groupTags])

  return (
    <div className={s.wrapper}>
      <div
        className={s.header}
        onClick={() => {
          toggleFolder(!isFolderOpen)

          // 当关闭 Folder 的时候，如果当前 Folder 没有被激活的 Tag, 那么就回到折叠状态
          // 如果有，那么保持原来的状态
          if (isFolderOpen && !isActiveTagInFolder) {
            setCurDisplayCount(initDisplayCount)
          }
        }}
      >
        <div className={s.title}>
          <div className={s.folderTitle}>{title}</div>

          <ArrowSVG className={s.arrowIcon} />
        </div>
      </div>

      <div className={s.content}>
        {sortedTags.slice(0, curDisplayCount).map((tag) => (
          <FileItem
            key={tag.slug}
            tag={tag}
            active={activeTag.title === tag.title}
            onSelect={onSelect}
          />
        ))}
        {needSubToggle && (
          <div
            className={s.subToggle}
            ref={subToggleRef}
            onClick={() => {
              setCurDisplayCount(
                curDisplayCount === maxDisplayCount ? groupTags.length : maxDisplayCount,
              )
            }}
          >
            {curDisplayCount === maxDisplayCount ? '展开...' : '收起'}
          </div>
        )}
      </div>
    </div>
  )
}

export default Folder
