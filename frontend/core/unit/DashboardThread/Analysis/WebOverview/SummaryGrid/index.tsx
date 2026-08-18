import { SUMMARY_ITEMS } from '../constant'
import { formatDuration, formatMetric, formatPercent } from '../helper'
import type { TAnalysisTrendsOverview, TSummaryMetricItem } from '../spec'
import MetricItem from './MetricItem'
import useSalon from './salon'

type TProps = {
  data: TAnalysisTrendsOverview
}

const summaryItems = (data: TAnalysisTrendsOverview): TSummaryMetricItem[] =>
  SUMMARY_ITEMS.map((item) => {
    const metric = data.summary[item.key]
    const value =
      item.key === 'bounceRate'
        ? formatPercent(metric)
        : item.key === 'visitDuration'
          ? formatDuration(metric.value)
          : formatMetric(metric)

    return { ...item, changeRate: metric.changeRate, value }
  })

export default function SummaryGrid({ data }: TProps) {
  const s = useSalon()
  const items = summaryItems(data)

  return (
    <section className={s.wrapper}>
      {items.map((item) => (
        <MetricItem key={item.key} item={item} />
      ))}
    </section>
  )
}
