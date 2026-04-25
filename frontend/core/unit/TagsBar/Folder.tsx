import { findIndex, reverse } from 'ramda'
import { type FC, useEffect, useMemo, useRef, useState } from 'react'
import { sortByColor } from '~/helper'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import MoreSVG from '~/icons/menu/MoreL'
import type { TTag } from '~/spec'
import useSalon from './salon/folder'
import TagItem from './TagItem'

type TProps = {
  title: string
  allTags: readonly TTag[]
  activeTag: TTag | null
  groupTags: readonly TTag[]
  maxDisplayCount: number
  totalCountThreshold: number

  onSelect: (tag?: TTag) => void
}

const Folder: FC<TProps> = ({
  title,
  groupTags,
  allTags,
  activeTag,
  maxDisplayCount,
  totalCountThreshold,
  onSelect,
}) => {
  // 决定是否显示 '展示更多' 的时候参考标签总数
  const needSubToggle = allTags?.length > totalCountThreshold && groupTags.length > maxDisplayCount

  const { t } = useTrans()
  const initDisplayCount = needSubToggle ? maxDisplayCount : groupTags.length

  const [isFolderOpen, toggleFolder] = useState(true)
  const [curDisplayCount, setCurDisplayCount] = useState(initDisplayCount)

  const sortedTags = useMemo(() => reverse(sortByColor([...groupTags])), [groupTags])
  const isActiveTagInFolder = useMemo(
    () => findIndex((item: TTag) => item.id === activeTag?.id, groupTags) >= 0,
    [activeTag?.id, groupTags],
  )

  const subToggleRef = useRef(null)

  const s = useSalon({ isFolderOpen })

  // 当选中的 Tag 被折叠在展示更多里面时，将其展开
  useEffect(() => {
    if (isActiveTagInFolder && curDisplayCount !== groupTags.length) {
      setCurDisplayCount(groupTags.length)
    }
  }, [curDisplayCount, isActiveTagInFolder, groupTags.length])

  return (
    <>
      <button
        type='button'
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
          {!isFolderOpen && <div className={s.count}>({sortedTags.length})</div>}
        </div>

        {!isFolderOpen && isActiveTagInFolder && <TagItem tag={activeTag} active />}

        <div className={s.arrowBox}>
          <ArrowSVG className={s.arrow} />
        </div>
      </button>

      <div className={s.content}>
        {sortedTags.slice(0, curDisplayCount).map((tag) => (
          <TagItem
            key={tag.slug}
            tag={tag}
            active={activeTag?.title === tag.title}
            onSelect={onSelect}
          />
        ))}
        {needSubToggle && (
          <button
            type='button'
            className={s.subToggle}
            ref={subToggleRef}
            onClick={() => {
              setCurDisplayCount(
                curDisplayCount === maxDisplayCount ? groupTags.length : maxDisplayCount,
              )
            }}
          >
            <MoreSVG className={s.toggleIcon} />
            <div className={s.subToggleTitle}>
              {curDisplayCount === maxDisplayCount
                ? t('tags.fold.expand')
                : t('tags.fold.collapse')}
            </div>
          </button>
        )}
      </div>
    </>
  )
}

export default Folder
