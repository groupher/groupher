import VIEW from '~/const/view'
import Tabs from '~/widgets/Switcher/Tabs'

import { DIMENSION_ROW_LIMIT } from '../constant'
import type { TAnalysisWebCountMetrics } from '../spec'
import Row from './Row'
import useSalon from './salon'

type TPanelMetrics = TAnalysisWebCountMetrics & {
  percentage?: number
}

export type TDimensionPanelTab = {
  key: string
  label: string
}

type TProps = {
  activeKey: string
  emptyLabel: string
  error?: string | null
  items: {
    value: string
    label: string
    metrics: TPanelMetrics
  }[]
  loading?: boolean
  metricKey?: keyof TAnalysisWebCountMetrics
  onTabChange: (key: string) => void
  tabs: TDimensionPanelTab[]
  title: string
}

export default function DimensionPanel({
  activeKey,
  emptyLabel,
  error,
  items,
  loading = false,
  metricKey,
  onTabChange,
  tabs,
  title,
}: TProps) {
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <h3 className={s.title}>{title}</h3>

      <div className={s.tabs}>
        <span className={s.divider} />
        <Tabs
          activeKey={activeKey}
          bottomSpace={0}
          items={tabs.map((tab) => ({ label: tab.label, slug: tab.key }))}
          left={-2}
          noAnimation
          topSpace={0}
          view={VIEW.DESKTOP}
          onChange={onTabChange}
        />
      </div>

      <div className={s.rows}>
        {loading ? (
          <div className={s.state}>Loading analytics…</div>
        ) : error ? (
          <div className={s.error}>{error}</div>
        ) : items.length > 0 ? (
          items
            .slice(0, DIMENSION_ROW_LIMIT)
            .map((item) => <Row key={item.value} item={item} metricKey={metricKey} />)
        ) : (
          <div className={s.state}>{emptyLabel}</div>
        )}
      </div>
    </section>
  )
}
