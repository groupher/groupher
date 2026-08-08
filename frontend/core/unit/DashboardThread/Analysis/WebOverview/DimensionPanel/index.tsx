'use client'

import { useMemo, useState } from 'react'

import VIEW from '~/const/view'
import Tabs from '~/ui/Switcher/Tabs'

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
  items: {
    value: string
    label: string
    metrics: TPanelMetrics
  }[]
}

type TProps = {
  emptyLabel: string
  metricKey?: keyof TAnalysisWebCountMetrics
  tabs: TDimensionPanelTab[]
  title: string
}

export default function DimensionPanel({ emptyLabel, metricKey, tabs, title }: TProps) {
  const s = useSalon()
  const [activeKey, setActiveKey] = useState(tabs[0]?.key ?? '')
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.key === activeKey) ?? tabs[0],
    [activeKey, tabs],
  )
  const items = activeTab?.items ?? []

  return (
    <section className={s.wrapper}>
      <h3 className={s.title}>{title}</h3>

      <div className={s.tabs}>
        <span className={s.divider} />
        <Tabs
          activeKey={activeTab?.key}
          bottomSpace={0}
          items={tabs.map((tab) => ({ label: tab.label, slug: tab.key }))}
          left={-2}
          noAnimation
          topSpace={0}
          view={VIEW.DESKTOP}
          onChange={(key) => setActiveKey(key)}
        />
      </div>

      <div className={s.rows}>
        {items.length > 0 ? (
          items
            .slice(0, DIMENSION_ROW_LIMIT)
            .map((item) => <Row key={item.value} item={item} metricKey={metricKey} />)
        ) : (
          <div className={s.empty}>{emptyLabel}</div>
        )}
      </div>
    </section>
  )
}
