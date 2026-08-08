'use client'

import { useState } from 'react'
import { useQuery } from 'urql'

import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import { ANALYSIS_TREND_PAGES_QUERY } from '../schema'
import type { TAnalysisTrendPagesSection, TAnalysisWebOverviewDemo } from '../spec'
import useSalon from './salon'

type TProps = {
  community: string
  days: number
  demoData?: TAnalysisWebOverviewDemo
}

type TData = {
  analysisTrendPages: TAnalysisTrendPagesSection | null
}

type TDemoDimension = 'PATH' | 'URL' | 'ENTRY' | 'EXIT' | 'TITLE' | 'QUERY'

const pageItemsFromDemo = (demoData: TAnalysisWebOverviewDemo, dimension: TDemoDimension) => {
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
  demoData: TAnalysisWebOverviewDemo,
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

  const [result] = useQuery<TData>({
    query: ANALYSIS_TREND_PAGES_QUERY,
    variables: { community, days, dimension },
    pause: isDemo,
    requestPolicy: 'cache-and-network',
  })
  const section =
    isDemo && demoData ? demoPagesSection(dimension, demoData) : result.data?.analysisTrendPages

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
        metricKey='visitors'
        tabs={TABS}
        title={WEB_OVERVIEW_TEXT.pages}
        onTabChange={(key) => setDimension(key as TDemoDimension)}
      />
    </div>
  )
}
