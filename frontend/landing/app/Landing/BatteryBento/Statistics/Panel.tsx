import type { FC } from 'react'

import ChartCard from './ChartCard'
import SummaryCard from './SummaryCard'

import useSalon from '../../salon/battery_bento/statistics/panel'

type TProps = {
  hovering: boolean
}

const Panel: FC<TProps> = ({ hovering }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <SummaryCard hovering={hovering} />
      <ChartCard hovering={hovering} />
    </div>
  )
}

export default Panel
