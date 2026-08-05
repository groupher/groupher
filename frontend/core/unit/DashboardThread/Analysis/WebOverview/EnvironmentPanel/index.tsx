'use client'

import { useState } from 'react'
import { useQuery } from 'urql'

import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import { ANALYSIS_TREND_ENVIRONMENT_QUERY } from '../schema'
import type { TAnalysisTrendEnvironmentSection } from '../spec'
import useSalon from './salon'

type TProps = {
  community: string
  days: number
}

type TData = {
  analysisTrendEnvironment: TAnalysisTrendEnvironmentSection | null
}

const TABS = [
  { key: 'BROWSER', label: WEB_OVERVIEW_TEXT.browsers },
  { key: 'OS', label: WEB_OVERVIEW_TEXT.os },
  { key: 'DEVICE', label: WEB_OVERVIEW_TEXT.devices },
  { key: 'LANGUAGE', label: 'Language' },
  { key: 'SCREEN', label: 'Screen' },
]

export default function EnvironmentPanel({ community, days }: TProps) {
  const s = useSalon()
  const [dimension, setDimension] = useState(TABS[0].key)
  const [result] = useQuery<TData>({
    query: ANALYSIS_TREND_ENVIRONMENT_QUERY,
    variables: { community, days, dimension },
    requestPolicy: 'cache-and-network',
  })
  const section = result.data?.analysisTrendEnvironment

  return (
    <div className={s.wrapper}>
      <DimensionPanel
        activeKey={dimension}
        emptyLabel={WEB_OVERVIEW_TEXT.empty}
        error={result.error?.message ?? section?.error?.message}
        items={section?.items ?? []}
        loading={result.fetching && !section}
        tabs={TABS}
        title={WEB_OVERVIEW_TEXT.environment}
        onTabChange={setDimension}
      />
    </div>
  )
}
