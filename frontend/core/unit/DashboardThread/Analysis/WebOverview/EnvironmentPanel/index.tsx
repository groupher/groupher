'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { graphqlQueryOptions } from '~/query'

import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import { ANALYSIS_TREND_ENVIRONMENT_QUERY } from '../schema'
import type { TAnalysisTrendEnvironmentSection, TAnalysisTrendsOverviewDemo } from '../spec'
import useSalon from './salon'

type TProps = {
  community: string
  days: number
  demoData?: TAnalysisTrendsOverviewDemo
}

type TData = {
  analysisTrendEnvironment: TAnalysisTrendEnvironmentSection | null
}

type TDemoDimension = 'BROWSER' | 'OS' | 'DEVICE' | 'LANGUAGE' | 'SCREEN'

const environmentItemsFromDemo = (
  demoData: TAnalysisTrendsOverviewDemo,
  dimension: TDemoDimension,
) => {
  const keyByDimension = {
    BROWSER: 'browser',
    OS: 'os',
    DEVICE: 'device',
    LANGUAGE: 'language',
    SCREEN: 'screen',
  } as const

  const key = keyByDimension[dimension]

  return key ? (demoData.environment[key] ?? []) : []
}

const demoEnvironmentSection = (
  dimension: TDemoDimension,
  demoData: TAnalysisTrendsOverviewDemo,
): TAnalysisTrendEnvironmentSection => ({
  status: 'ok',
  items: environmentItemsFromDemo(demoData, dimension),
  error: null,
})

const TABS = [
  { key: 'BROWSER', label: WEB_OVERVIEW_TEXT.browsers },
  { key: 'OS', label: WEB_OVERVIEW_TEXT.os },
  { key: 'DEVICE', label: WEB_OVERVIEW_TEXT.devices },
  { key: 'LANGUAGE', label: 'Language' },
  { key: 'SCREEN', label: 'Screen' },
]

export default function EnvironmentPanel({ community, days, demoData }: TProps) {
  const s = useSalon()
  const [dimension, setDimension] = useState<TDemoDimension>(TABS[0].key as TDemoDimension)
  const isDemo = Boolean(demoData)

  const result = useQuery({
    ...graphqlQueryOptions<TData>(ANALYSIS_TREND_ENVIRONMENT_QUERY, {
      community,
      days,
      dimension,
    }),
    enabled: !isDemo,
  })
  const section =
    isDemo && demoData
      ? demoEnvironmentSection(dimension, demoData)
      : result.data?.analysisTrendEnvironment

  const loading = isDemo ? false : result.isFetching && !section
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
        title={WEB_OVERVIEW_TEXT.environment}
        onTabChange={(key) => setDimension(key as TDemoDimension)}
      />
    </div>
  )
}
