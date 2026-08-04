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

const cacheKey = (community: string): string => `groupher:trend:${community}`

const readCachedOverview = (community: string): TAnalysisWebOverview | null => {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(cacheKey(community))
    if (!raw) return null

    const parsed = JSON.parse(raw) as TAnalysisWebOverview
    return parsed?.summary ? parsed : null
  } catch {
    return null
  }
}

const writeCachedOverview = (community: string, overview: TAnalysisWebOverview): void => {
  try {
    window.sessionStorage.setItem(cacheKey(community), JSON.stringify(overview))
  } catch {
    // Ignore storage quota and private-mode failures; live data is still rendered.
  }
}

function TrendLoading() {
  return (
    <div className='column w-full'>
      <section className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5'>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className='rounded-md px-4 py-3'>
            <div className='bg-divider h-3 w-20 animate-pulse rounded-sm' />
            <div className='bg-divider mt-4 h-8 w-12 animate-pulse rounded-sm' />
          </div>
        ))}
      </section>

      <section className='mt-5 rounded-md p-5'>
        <div className='bg-divider h-4 w-24 animate-pulse rounded-sm' />
        <div className='bg-divider mt-6 h-72 w-full animate-pulse rounded-md' />
      </section>

      <section className='mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2'>
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className='rounded-md p-5'>
            <div className='bg-divider h-4 w-20 animate-pulse rounded-sm' />
            <div className='mt-6 space-y-4'>
              {Array.from({ length: 3 }).map((__, rowIndex) => (
                <div key={rowIndex} className='bg-divider h-3 w-full animate-pulse rounded-sm' />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

export default function TrendClient({ community }: TProps) {
  const [data, setData] = useState<TAnalysisWebOverview | null>(() => readCachedOverview(community))
  const [loaded, setLoaded] = useState(() => readCachedOverview(community) !== null)

  useEffect(() => {
    const controller = new AbortController()
    const cachedOverview = readCachedOverview(community)

    setData(cachedOverview)
    setLoaded(cachedOverview !== null)

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
        if (!payload.errors && overview) {
          setData(overview)
          setLoaded(true)
          writeCachedOverview(community, overview)
          return
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error('## web analysis client error: ', error)
      } finally {
        if (!controller.signal.aborted) setLoaded(true)
      }
    }

    load()

    return () => controller.abort()
  }, [community])

  if (!data && !loaded) return <TrendLoading />

  return <WebOverview data={data ?? emptyOverview(community)} />
}
