import type { FC } from 'react'

import type { TProps as TAvatarsProps } from '.'
import useSalon from './salon/more_item'

type TProps = Pick<TAvatarsProps, 'size' | 'onTotalSelect'>

const MoreItem: FC<TProps> = ({ size, onTotalSelect }) => {
  const s = useSalon({ size })

  return (
    <button type='button' className={s.wrapper} onClick={() => onTotalSelect()}>
      <div className={s.textMore}>..</div>
    </button>
  )
}

export default MoreItem
