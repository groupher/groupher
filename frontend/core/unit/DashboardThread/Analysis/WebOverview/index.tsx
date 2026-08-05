'use client'

import useTrans from '~/hooks/useTrans'

import { DEMO_OVERVIEW, WEB_OVERVIEW_TRANS } from './constant'
import EnvironmentPanel from './EnvironmentPanel'
import { shouldUseDemoData } from './helper'
import LocationPanel from './LocationPanel'
import PagesPanel from './PagesPanel'
import useSalon from './salon'
import SourcesPanel from './SourcesPanel'
import type { TAnalysisTrendsOverview } from './spec'
import SummaryGrid from './SummaryGrid'
import TrafficPanel from './TrafficPanel'
import TrendChart from './TrendChart'

type TProps = {
  community: string
  data: TAnalysisTrendsOverview
}

export default function WebOverview({ community, data }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const displayData = shouldUseDemoData(data) ? DEMO_OVERVIEW : data

  return (
    <div className={s.wrapper}>
      <SummaryGrid data={displayData} />

      <section className={s.chartSection}>
        <TrendChart
          emptyLabel={t(WEB_OVERVIEW_TRANS.empty)}
          points={displayData.chart.points}
          title={t(WEB_OVERVIEW_TRANS.trend)}
          viewsLabel={t(WEB_OVERVIEW_TRANS.pageviews)}
          visitsLabel={t(WEB_OVERVIEW_TRANS.visits)}
        />
      </section>

      {data.errors.length > 0 && (
        <p className={s.error}>{data.errors[0]?.message || t(WEB_OVERVIEW_TRANS.unavailable)}</p>
      )}

      <section className={s.panels}>
        <div className={s.panelGrid}>
          <PagesPanel community={community} days={displayData.range.days} />
          <SourcesPanel community={community} days={displayData.range.days} />
        </div>

        <div className={s.panelGrid}>
          <EnvironmentPanel community={community} days={displayData.range.days} />
          <LocationPanel community={community} days={displayData.range.days} />
        </div>

        <TrafficPanel community={community} days={displayData.range.days} />
      </section>
    </div>
  )
}
