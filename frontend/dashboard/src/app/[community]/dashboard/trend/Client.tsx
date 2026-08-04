'use client'

import { useEffect, useState } from 'react'

import WebOverview from '~/unit/DashboardThread/Analysis/WebOverview'
import type { TAnalysisWebOverview } from '~/unit/DashboardThread/Analysis/WebOverview/spec'

import { ANALYSIS_WEB_OVERVIEW_QUERY, emptyOverview } from './helper'

type TGraphQLError = { message?: unknown }
type TGraphQLPayload<T> = { data?: T | null; errors?: TGraphQLError[] }

type TAnalysisWebQueryData = {
  analysisWebOverview: TAnalysisWebOverview | null
}

type TProps = {
  community: string
}

export default function TrendClient({ community }: TProps) {
  const [data, setData] = useState<TAnalysisWebOverview>(() => emptyOverview(community))

  useEffect(() => {
    const controller = new AbortController()

    const load = async (): Promise<void> => {
      try {
        const response = await fetch('/api/graphql', {
          body: JSON.stringify({
            query: ANALYSIS_WEB_OVERVIEW_QUERY,
            variables: { community, days: 7 },
          }),
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          signal: controller.signal,
        })

        if (!response.ok) return

        const payload = (await response.json()) as TGraphQLPayload<TAnalysisWebQueryData>
        const overview = payload.data?.analysisWebOverview
        if (!payload.errors && overview) setData(overview)
      } catch (error) {
        if (!controller.signal.aborted) console.error('## web analysis client error: ', error)
      }
    }

    load()

    return () => controller.abort()
  }, [community])

  return <WebOverview data={data} />
}
