/*
 *
 * TagNote
 *
 */

import type { TColorName, TSpace } from '~/spec'
import Markdown from '~/widgets/Markdown'
import TagNode from '~/widgets/TagNode'

import useSalon from './salon'
import useLogic from './useLogic'

type TProps = TSpace

export default function TagNote({ ...spacing }: TProps) {
  const { tag, stats } = useLogic()
  const s = useSalon({ ...spacing })

  if (!tag?.title) return null

  const todayCount = stats?.todayContentsCount || 0
  const contentsCount = stats?.contentsCount || 0

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.tagWrapper}>
          <TagNode
            color={tag.color as TColorName}
            dotSize={8}
            hashSize={3}
            dotLeft={5}
            hashLeft={0.5}
            hashRight={1}
            boldHash
          />
          <div className={s.title}>{tag.title}</div>
        </div>
        <div className={s.stats}>
          <span className={s.statLabel}>今日</span>
          <span className={s.statNum}>{todayCount}</span>
          <span className='mx-0.5' />
          <span className={s.statLabel}>主题</span>
          <span className={s.statNum}>{contentsCount}</span>
        </div>
      </div>
      <Markdown>{tag.desc || ''}</Markdown>
    </div>
  )
}
