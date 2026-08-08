import type { FC } from 'react'

import type { TProps as TAvatarsProps } from '.'
import useSalon from './salon/more_item'

type TProps = Pick<TAvatarsProps, 'size' | 'onTotalSelect'>

const MoreItem: FC<TProps> = ({ size, onTotalSelect }) => {
  const interactive = Boolean(onTotalSelect)
  const s = useSalon({ size, interactive })
  const content = <div className={s.textMore}>..</div>

  return (
    <li className={s.wrapper}>
      {interactive ? (
        <button type='button' className={s.control} onClick={() => onTotalSelect?.()}>
          {content}
        </button>
      ) : (
        <span className={s.control}>{content}</span>
      )}
    </li>
  )
}

export default MoreItem
