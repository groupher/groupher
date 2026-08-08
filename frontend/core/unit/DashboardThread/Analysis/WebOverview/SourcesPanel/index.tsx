'use client'

import { useState } from 'react'
import { useQuery } from 'urql'

import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import { ANALYSIS_TREND_SOURCES_QUERY } from '../schema'
import type { TAnalysisTrendSourcesSection, TAnalysisTrendsOverviewDemo } from '../spec'
import useSalon from './salon'

type TProps = {
  community: string
  days: number
  demoData?: TAnalysisTrendsOverviewDemo
}

type TData = {
  analysisTrendSources: TAnalysisTrendSourcesSection | null
}

type TDemoDimension = 'REFERRER' | 'CHANNEL' | 'DOMAIN'

const sourceItemsFromDemo = (demoData: TAnalysisTrendsOverviewDemo, dimension: TDemoDimension) => {
  const keyByDimension = {
    REFERRER: 'referrer',
    CHANNEL: 'channel',
    DOMAIN: 'domain',
  } as const

  const key = keyByDimension[dimension]

  return key ? (demoData.sources[key] ?? []) : []
}

const demoSourcesSection = (
  dimension: TDemoDimension,
  demoData: TAnalysisTrendsOverviewDemo,
): TAnalysisTrendSourcesSection => ({
  status: 'ok',
  items: sourceItemsFromDemo(demoData, dimension),
  error: null,
})

const TABS = [
  { key: 'REFERRER', label: WEB_OVERVIEW_TEXT.referrers },
  { key: 'CHANNEL', label: WEB_OVERVIEW_TEXT.channels },
  { key: 'DOMAIN', label: WEB_OVERVIEW_TEXT.domains },
]

export default function SourcesPanel({ community, days, demoData }: TProps) {
  const s = useSalon()
  const [dimension, setDimension] = useState<TDemoDimension>(TABS[0].key as TDemoDimension)
  const isDemo = Boolean(demoData)

  const [result] = useQuery<TData>({
    query: ANALYSIS_TREND_SOURCES_QUERY,
    variables: { community, days, dimension },
    pause: isDemo,
    requestPolicy: 'cache-and-network',
  })
  const section =
    isDemo && demoData ? demoSourcesSection(dimension, demoData) : result.data?.analysisTrendSources

  const loading = isDemo ? false : result.fetching && !section
  const error = isDemo ? null : (result.error?.message ?? section?.error?.message)

  return (
    <div className={s.wrapper}>
      <DimensionPanel
        activeKey={dimension}
        emptyLabel={WEB_OVERVIEW_TEXT.empty}
        error={error}
        items={section?.items ?? []}
        loading={loading}
        tabs={TABS}
        title={WEB_OVERVIEW_TEXT.sources}
        onTabChange={(key) => setDimension(key as TDemoDimension)}
      />
    </div>
  )
}
