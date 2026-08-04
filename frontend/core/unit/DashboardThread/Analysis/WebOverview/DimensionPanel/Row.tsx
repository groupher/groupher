import { prettyNum } from '~/fmt'

import { percentageOf } from '../helper'
import type { TAnalysisWebCountMetrics, TAnalysisWebDimensionMetrics } from '../spec'
import useSalon from './salon/row'

type TRowMetrics = TAnalysisWebCountMetrics | TAnalysisWebDimensionMetrics

type TProps = {
  item: {
    label: string
    metrics: TRowMetrics
  }
  metricKey?: keyof TAnalysisWebCountMetrics
}

export default function DimensionRow({ item, metricKey = 'visitors' }: TProps) {
  const s = useSalon()
  const percentage = percentageOf(item.metrics)

  return (
    <div className={s.wrapper}>
      <span className={s.label}>{item.label}</span>
      <div className={s.metrics}>
        <span className={s.value}>{prettyNum(item.metrics[metricKey])}</span>
        {percentage !== null ? (
          <>
            <span className={s.divider} />
            <span>{percentage}%</span>
          </>
        ) : null}
      </div>
    </div>
  )
}
