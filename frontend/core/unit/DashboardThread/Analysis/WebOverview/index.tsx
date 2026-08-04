'use client'

import useTrans from '~/hooks/useTrans'

import { DEMO_OVERVIEW, WEB_OVERVIEW_TRANS } from './constant'
import EnvironmentPanel from './EnvironmentPanel'
import { shouldUseDemoData } from './helper'
import LocationPanel from './LocationPanel'
import MapPanel from './MapPanel'
import PagesPanel from './PagesPanel'
import useSalon from './salon'
import SourcesPanel from './SourcesPanel'
import type { TAnalysisWebOverview } from './spec'
import SummaryGrid from './SummaryGrid'
import TrafficPanel from './TrafficPanel'
import TrendChart from './TrendChart'

type TProps = {
  data: TAnalysisWebOverview
}

export default function WebOverview({ data }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const displayData = shouldUseDemoData(data) ? DEMO_OVERVIEW : data

  return (
    <div className={s.wrapper}>
      <SummaryGrid data={displayData} />

      <section className={s.chartSection}>
        <TrendChart
          emptyLabel={t(WEB_OVERVIEW_TRANS.empty)}
          points={displayData.timeseries.points}
          title={t(WEB_OVERVIEW_TRANS.trend)}
          viewsLabel={t(WEB_OVERVIEW_TRANS.pageviews)}
          visitsLabel={t(WEB_OVERVIEW_TRANS.visits)}
        />
      </section>

      <section className={s.panels}>
        <div className={s.panelGrid}>
          <PagesPanel data={displayData.pages} />
          <SourcesPanel data={displayData.sources} />
        </div>

        <div className={s.panelGrid}>
          <EnvironmentPanel data={displayData.environment} />
          <LocationPanel data={displayData.location} />
        </div>

        <div className={s.panelGrid}>
          <MapPanel countries={displayData.location.country} />
          <TrafficPanel cells={displayData.traffic.cells} />
        </div>
      </section>
    </div>
  )
}
