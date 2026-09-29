import type { FC } from 'react'

import ViewedSVG from '~/icons/article/Viewed'
import type { TSpace } from '~/spec'

import useSalon, { cn } from './salon'

type TProps = {
  count?: number
} & TSpace

const ViewsCount: FC<TProps> = ({ count, ...spacing }) => {
  const resolvedCount = count ?? 0
  const isHighLight = resolvedCount >= 400

  const s = useSalon({ isHighLight, ...spacing })

  return isHighLight ? (
    <div className={cn(s.wrapper, s.highLight)}>
      <ViewedSVG className={s.viewIcon} />
      <div
        className={cn(s.count, count === undefined && 'view-count-slot-list')}
        aria-label='views'
      >
        {count === undefined ? null : resolvedCount}
      </div>
    </div>
  ) : (
    <div className={s.wrapper}>
      <ViewedSVG className={s.viewIcon} />
      <div
        className={cn(s.count, count === undefined && 'view-count-slot-list')}
        aria-label='views'
      >
        {count === undefined ? null : resolvedCount}
      </div>
    </div>
  )
}

export default ViewsCount
