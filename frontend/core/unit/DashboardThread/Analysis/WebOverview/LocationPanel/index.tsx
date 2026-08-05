'use client'

import { useState } from 'react'
import { useQuery } from 'urql'

import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import { ANALYSIS_TREND_LOCATION_QUERY } from '../schema'
import type { TAnalysisTrendLocationSection } from '../spec'
import useSalon from './salon'

type TProps = {
  community: string
  days: number
}

type TData = {
  analysisTrendLocation: TAnalysisTrendLocationSection | null
}

const TABS = [
  { key: 'COUNTRY', label: WEB_OVERVIEW_TEXT.countries },
  { key: 'REGION', label: WEB_OVERVIEW_TEXT.regions },
  { key: 'CITY', label: WEB_OVERVIEW_TEXT.cities },
]

export default function LocationPanel({ community, days }: TProps) {
  const s = useSalon()
  const [dimension, setDimension] = useState(TABS[0].key)
  const [result] = useQuery<TData>({
    query: ANALYSIS_TREND_LOCATION_QUERY,
    variables: { community, days, dimension },
    requestPolicy: 'cache-and-network',
  })
  const section = result.data?.analysisTrendLocation

  return (
    <div className={s.wrapper}>
      <DimensionPanel
        activeKey={dimension}
        emptyLabel={WEB_OVERVIEW_TEXT.empty}
        error={result.error?.message ?? section?.error?.message}
        items={section?.items ?? []}
        loading={result.fetching && !section}
        tabs={TABS}
        title={WEB_OVERVIEW_TEXT.location}
        onTabChange={setDimension}
      />
    </div>
  )
}
