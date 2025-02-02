import type { FC } from 'react'

import type { TSpace } from '~/spec'

import ViewedSVG from '~/icons/article/Viewed'
import useSalon, { cn } from './salon'

type TProps = {
  count: number
} & TSpace

const ViewsCount: FC<TProps> = ({ count, ...spacing }) => {
  const isHighLight = count >= 400

  const s = useSalon({ isHighLight, ...spacing })

  return (
    <>
      {isHighLight ? (
        <div className={cn(s.wrapper, s.highLight)}>
          <ViewedSVG className={s.viewIcon} />
          <div className={s.count}>{count}</div>
        </div>
      ) : (
        <div className={s.wrapper}>
          <ViewedSVG className={s.viewIcon} />
          <div className={s.count}>{count}</div>
        </div>
      )}
    </>
  )
}

export default ViewsCount
