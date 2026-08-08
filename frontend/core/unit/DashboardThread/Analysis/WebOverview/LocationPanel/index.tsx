'use client'

import { useState } from 'react'
import { useQuery } from 'urql'

import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import { ANALYSIS_TREND_LOCATION_QUERY } from '../schema'
import type { TAnalysisTrendLocationSection, TAnalysisTrendsOverviewDemo } from '../spec'
import useSalon from './salon'

type TProps = {
  community: string
  days: number
  demoData?: TAnalysisTrendsOverviewDemo
}

type TData = {
  analysisTrendLocation: TAnalysisTrendLocationSection | null
}

type TDemoDimension = 'COUNTRY' | 'REGION' | 'CITY'

const locationItemsFromDemo = (
  demoData: TAnalysisTrendsOverviewDemo,
  dimension: TDemoDimension,
) => {
  const keyByDimension = {
    COUNTRY: 'country',
    REGION: 'region',
    CITY: 'city',
  } as const

  const key = keyByDimension[dimension]

  return key ? (demoData.location[key] ?? []) : []
}

const demoLocationSection = (
  dimension: TDemoDimension,
  demoData: TAnalysisTrendsOverviewDemo,
): TAnalysisTrendLocationSection => ({
  status: 'ok',
  items: locationItemsFromDemo(demoData, dimension),
  error: null,
})

const TABS = [
  { key: 'COUNTRY', label: WEB_OVERVIEW_TEXT.countries },
  { key: 'REGION', label: WEB_OVERVIEW_TEXT.regions },
  { key: 'CITY', label: WEB_OVERVIEW_TEXT.cities },
]

export default function LocationPanel({ community, days, demoData }: TProps) {
  const s = useSalon()
  const [dimension, setDimension] = useState<TDemoDimension>(TABS[0].key as TDemoDimension)
  const isDemo = Boolean(demoData)

  const [result] = useQuery<TData>({
    query: ANALYSIS_TREND_LOCATION_QUERY,
    variables: { community, days, dimension },
    pause: isDemo,
    requestPolicy: 'cache-and-network',
  })
  const section =
    isDemo && demoData
      ? demoLocationSection(dimension, demoData)
      : result.data?.analysisTrendLocation

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
        title={WEB_OVERVIEW_TEXT.location}
        onTabChange={(key) => setDimension(key as TDemoDimension)}
      />
    </div>
  )
}
