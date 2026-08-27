'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { graphqlQueryOptions } from '~/query'

import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import { ANALYSIS_TREND_PAGES_QUERY } from '../schema'
import type { TAnalysisTrendPagesSection, TAnalysisTrendsOverviewDemo } from '../spec'
import useSalon from './salon'

type TProps = {
  community: string
  days: number
  demoData?: TAnalysisTrendsOverviewDemo
}

type TData = {
  analysisTrendPages: TAnalysisTrendPagesSection | null
}

type TDemoDimension = 'PATH' | 'URL' | 'ENTRY' | 'EXIT' | 'TITLE' | 'QUERY'

const pageItemsFromDemo = (demoData: TAnalysisTrendsOverviewDemo, dimension: TDemoDimension) => {
  const keyByDimension = {
    PATH: 'path',
    URL: 'url',
    ENTRY: 'entry',
    EXIT: 'exit',
    TITLE: 'title',
    QUERY: 'query',
  } as const

  const key = keyByDimension[dimension]

  return key ? (demoData.pages[key] ?? []) : []
}

const demoPagesSection = (
  dimension: TDemoDimension,
  demoData: TAnalysisTrendsOverviewDemo,
): TAnalysisTrendPagesSection => {
  return {
    status: 'ok',
    items: pageItemsFromDemo(demoData, dimension),
    error: null,
  }
}

const TABS = [
  { key: 'PATH', label: WEB_OVERVIEW_TEXT.path },
  { key: 'ENTRY', label: WEB_OVERVIEW_TEXT.entryPage },
  { key: 'EXIT', label: WEB_OVERVIEW_TEXT.exitPage },
  { key: 'TITLE', label: 'Title' },
  { key: 'QUERY', label: 'Query' },
]

export default function PagesPanel({ community, days, demoData }: TProps) {
  const s = useSalon()
  const [dimension, setDimension] = useState<TDemoDimension>(TABS[0].key as TDemoDimension)
  const isDemo = Boolean(demoData)

  const result = useQuery({
    ...graphqlQueryOptions<TData>(ANALYSIS_TREND_PAGES_QUERY, {
      community,
      days,
      dimension,
    }),
    enabled: !isDemo,
  })
  const section =
    isDemo && demoData ? demoPagesSection(dimension, demoData) : result.data?.analysisTrendPages

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
        metricKey='visitors'
        tabs={TABS}
        title={WEB_OVERVIEW_TEXT.pages}
        onTabChange={(key) => setDimension(key as TDemoDimension)}
      />
    </div>
  )
}
