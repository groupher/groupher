import type { FC } from 'react'

import SprintSVG from '~/icons/Sprint'

import useSalon from '../../salon/compare_dev/our_way/sprint_counter'

type TProps = {
  num?: number
}

const SprintCounter: FC<TProps> = ({ num = 13 }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <SprintSVG className={s.icon} />
      <div className={s.text}>第</div>
      <div className={s.count}>{num}</div>
      <div className={s.text}>周</div>
    </div>
  )
}

export default SprintCounter
