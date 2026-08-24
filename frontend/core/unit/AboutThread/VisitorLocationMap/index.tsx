'use client'

import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TVisitorLocationMap } from '~/spec'
import useCommunity from '~/stores/community/hooks'

import CountryList from './CountryList'
import useSalon from './salon'

const VisitorGlobe = lazy(() => import('./VisitorGlobe'))

export default function VisitorLocationMap() {
  const s = useSalon()
  const { slug: community } = useCommunity()
  const { t, locale } = useTrans()
  const [globeUnavailable, setGlobeUnavailable] = useState(false)
  const onGlobeUnavailable = useCallback(() => setGlobeUnavailable(true), [])

  const query = useQuery({
    queryKey: ['visitor-location-map', community, locale],
    queryFn: async () => {
      const response = await fetch(
        `/api/visitor-location-map/${encodeURIComponent(community)}?locale=${encodeURIComponent(locale)}`,
      )
      if (!response.ok) throw new Error('visitor location map unavailable')
      return (await response.json()) as TVisitorLocationMap
    },
    staleTime: 5 * 60 * 1000,
  })

  if (query.isPending) return <div className={s.loading} aria-hidden='true' />
  if (!query.data || query.data.status !== 'ok' || query.data.countries.length === 0) return null

  const { countries, days, markers } = query.data

  return (
    <section className={s.wrapper}>
      <h2 className={s.title}>{t('about.visitor_location.title', { days })}</h2>
      <div className={s.content}>
        <div className={globeUnavailable ? s.globeHidden : s.globe}>
          <Suspense fallback={null}>
            <VisitorGlobe
              ariaLabel={t('about.visitor_location.globe_aria')}
              markers={markers}
              onUnavailable={onGlobeUnavailable}
            />
          </Suspense>
        </div>
        <CountryList countries={countries} fullWidth={globeUnavailable} />
      </div>
    </section>
  )
}
