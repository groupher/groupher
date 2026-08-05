'use client'

import { useState } from 'react'
import { useQuery } from 'urql'

import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import { ANALYSIS_TREND_PAGES_QUERY } from '../schema'
import type { TAnalysisTrendPagesSection } from '../spec'
import useSalon from './salon'

type TProps = {
  community: string
  days: number
}

type TData = {
  analysisTrendPages: TAnalysisTrendPagesSection | null
}

const TABS = [
  { key: 'PATH', label: WEB_OVERVIEW_TEXT.path },
  { key: 'ENTRY', label: WEB_OVERVIEW_TEXT.entryPage },
  { key: 'EXIT', label: WEB_OVERVIEW_TEXT.exitPage },
  { key: 'TITLE', label: 'Title' },
  { key: 'QUERY', label: 'Query' },
]

export default function PagesPanel({ community, days }: TProps) {
  const s = useSalon()
  const [dimension, setDimension] = useState(TABS[0].key)
  const [result] = useQuery<TData>({
    query: ANALYSIS_TREND_PAGES_QUERY,
    variables: { community, days, dimension },
    requestPolicy: 'cache-and-network',
  })
  const section = result.data?.analysisTrendPages

  return (
    <div className={s.wrapper}>
      <DimensionPanel
        activeKey={dimension}
        emptyLabel={WEB_OVERVIEW_TEXT.empty}
        error={result.error?.message ?? section?.error?.message}
        items={section?.items ?? []}
        loading={result.fetching && !section}
        metricKey='visitors'
        tabs={TABS}
        title={WEB_OVERVIEW_TEXT.pages}
        onTabChange={setDimension}
      />
    </div>
  )
}
