/*
 *
 * TagNote
 *
 */

import { lazy, Suspense } from 'react'

import useDidMount from '~/hooks/useDidMount'
import useTrans from '~/hooks/useTrans'
import type { TColorName, TSpace } from '~/spec'
import TagNode from '~/ui/TagNode'

import useSalon from './salon'
import useLogic from './useLogic'

type TProps = TSpace

const Markdown = lazy(() => import('~/render/Markdown'))

export default function TagNote({ ...spacing }: TProps) {
  const { tag, stats } = useLogic()
  const { t } = useTrans()
  const s = useSalon({ ...spacing })
  const didMount = useDidMount()

  if (!tag?.title) return null

  const todayCount = stats?.todayContentsCount || 0
  const contentsCount = stats?.contentsCount || 0

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.tagWrapper}>
          <TagNode
            color={tag.color as TColorName}
            marker={tag.marker}
            dotSize={8}
            hashSize={3}
            iconSize={3}
            dotLeft={5}
            hashLeft={0.5}
            iconLeft={0.5}
            hashRight={1}
            iconRight={1}
            boldHash
          />
          <div className={s.title}>{tag.title}</div>
        </div>
        <div className={s.stats}>
          <span className={s.statLabel}>{t('tag.stat.today')}</span>
          <span className={s.statNum}>{todayCount}</span>
          <span className='mx-0.5' />
          <span className={s.statLabel}>{t('tag.stat.topic')}</span>
          <span className={s.statNum}>{contentsCount}</span>
        </div>
      </div>
      {tag.desc && didMount ? (
        <Suspense fallback={null}>
          <Markdown>{tag.desc}</Markdown>
        </Suspense>
      ) : null}
    </div>
  )
}
