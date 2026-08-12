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
  maxMetric: number
  metricKey?: keyof TAnalysisWebCountMetrics
}

export default function DimensionRow({ item, maxMetric, metricKey = 'visitors' }: TProps) {
  const s = useSalon()
  const percentage = percentageOf(item.metrics)
  const barWidth = (item.metrics[metricKey] / maxMetric) * 100

  return (
    <div className={s.wrapper}>
      <div className={s.barArea}>
        <div aria-hidden='true' className={s.bar} style={{ width: `${barWidth}%` }} />
        <span className={s.label}>{item.label}</span>
      </div>
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
