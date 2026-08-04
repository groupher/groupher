import { SUMMARY_ITEMS } from '../constant'
import { formatDuration, formatMetric, formatPercent } from '../helper'
import type { TAnalysisWebOverview, TSummaryMetricItem } from '../spec'
import MetricItem from './MetricItem'
import useSalon from './salon'

type TProps = {
  data: TAnalysisWebOverview
}

const summaryItems = (data: TAnalysisWebOverview): TSummaryMetricItem[] =>
  SUMMARY_ITEMS.map((item) => {
    const metric = data.summary[item.key]
    const value =
      item.key === 'bounceRate'
        ? formatPercent(metric)
        : item.key === 'visitDuration'
          ? formatDuration(metric.value)
          : formatMetric(metric)

    return { ...item, value }
  })

export default function SummaryGrid({ data }: TProps) {
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      {summaryItems(data).map((item) => (
        <MetricItem key={item.key} item={item} />
      ))}
    </section>
  )
}
