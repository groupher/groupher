import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import SprintSVG from '~/icons/Sprint'

import useSalon from '../../salon/compare_dev/our_way/sprint_counter'

type TProps = {
  num?: number
}

const SprintCounter: FC<TProps> = ({ num = 13 }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <SprintSVG className={s.icon} />
      <div className={s.text}>{t('landing.compare.sprint.prefix')}</div>
      <div className={s.count}>{num}</div>
      <div className={s.text}>{t('landing.compare.sprint.suffix')}</div>
    </div>
  )
}

export default SprintCounter
