'use client'

import { useState } from 'react'
import { useQuery } from 'urql'

import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import { ANALYSIS_TREND_SOURCES_QUERY } from '../schema'
import type { TAnalysisTrendSourcesSection } from '../spec'
import useSalon from './salon'

type TProps = {
  community: string
  days: number
}

type TData = {
  analysisTrendSources: TAnalysisTrendSourcesSection | null
}

const TABS = [
  { key: 'REFERRER', label: WEB_OVERVIEW_TEXT.referrers },
  { key: 'CHANNEL', label: WEB_OVERVIEW_TEXT.channels },
  { key: 'DOMAIN', label: WEB_OVERVIEW_TEXT.domains },
]

export default function SourcesPanel({ community, days }: TProps) {
  const s = useSalon()
  const [dimension, setDimension] = useState(TABS[0].key)
  const [result] = useQuery<TData>({
    query: ANALYSIS_TREND_SOURCES_QUERY,
    variables: { community, days, dimension },
    requestPolicy: 'cache-and-network',
  })
  const section = result.data?.analysisTrendSources

  return (
    <div className={s.wrapper}>
      <DimensionPanel
        activeKey={dimension}
        emptyLabel={WEB_OVERVIEW_TEXT.empty}
        error={result.error?.message ?? section?.error?.message}
        items={section?.items ?? []}
        loading={result.fetching && !section}
        tabs={TABS}
        title={WEB_OVERVIEW_TEXT.sources}
        onTabChange={setDimension}
      />
    </div>
  )
}
