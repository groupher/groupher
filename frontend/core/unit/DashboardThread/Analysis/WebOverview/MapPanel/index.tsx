'use client'

import { useMemo } from 'react'

import { WEB_OVERVIEW_TEXT } from '../constant'
import type { TAnalysisWebOverview } from '../spec'
import useSalon from './salon'

type TCountry = TAnalysisWebOverview['location']['country'][number]

type TMapPoint = {
  code: string
  x: number
  y: number
}

const COUNTRY_POINTS: TMapPoint[] = [
  { code: 'US', x: 145, y: 132 },
  { code: 'CA', x: 138, y: 94 },
  { code: 'BR', x: 220, y: 230 },
  { code: 'GB', x: 325, y: 101 },
  { code: 'FR', x: 340, y: 124 },
  { code: 'DE', x: 360, y: 113 },
  { code: 'RU', x: 470, y: 89 },
  { code: 'IN', x: 475, y: 175 },
  { code: 'CN', x: 520, y: 150 },
  { code: 'JP', x: 600, y: 150 },
  { code: 'AU', x: 565, y: 255 },
]

const findMapPoint = (country: TCountry): TMapPoint | null => {
  const code = country.code ?? country.value

  return COUNTRY_POINTS.find((point) => point.code === code.toUpperCase()) ?? null
}

export default function MapPanel({ countries }: { countries: TCountry[] }) {
  const s = useSalon()
  const maxVisitors = Math.max(...countries.map((country) => country.metrics.visitors), 1)
  const points = useMemo(() => {
    return countries
      .map((country) => {
        const point = findMapPoint(country)
        if (!point) return null

        const ratio = country.metrics.visitors / maxVisitors

        return {
          ...point,
          label: country.label,
          visitors: country.metrics.visitors,
          radius: 5 + ratio * 13,
          opacity: 0.28 + ratio * 0.58,
        }
      })
      .filter((point) => point !== null)
  }, [countries, maxVisitors])

  return (
    <section className={s.wrapper}>
      <h3 className={s.title}>{WEB_OVERVIEW_TEXT.location}</h3>

      <div className={s.mapFrame}>
        <svg aria-label={WEB_OVERVIEW_TEXT.location} className={s.map} viewBox='0 0 680 340'>
          <g className={s.land}>
            <path d='M80 116 123 92l67 14 38 33-20 42-48 18-62-19-34-31z' />
            <path d='m194 198 42 12 18 42-18 50-31-23-28-52z' />
            <path d='m316 98 58-19 52 14 31 34-18 37-58 12-63-28z' />
            <path d='m430 122 83-31 76 19 34 45-35 42-92-5-68-33z' />
            <path d='m343 178 54 13 33 52-22 63-54-27-28-58z' />
            <path d='m510 238 64 4 38 34-20 33-62-10-35-31z' />
          </g>
          <g className={s.stroke}>
            <path d='M80 116 123 92l67 14 38 33-20 42-48 18-62-19-34-31z' />
            <path d='m194 198 42 12 18 42-18 50-31-23-28-52z' />
            <path d='m316 98 58-19 52 14 31 34-18 37-58 12-63-28z' />
            <path d='m430 122 83-31 76 19 34 45-35 42-92-5-68-33z' />
            <path d='m343 178 54 13 33 52-22 63-54-27-28-58z' />
            <path d='m510 238 64 4 38 34-20 33-62-10-35-31z' />
          </g>

          {points.map((point) => (
            <g key={point.code}>
              <circle
                cx={point.x}
                cy={point.y}
                fill='var(--color-primary-custom)'
                opacity={point.opacity}
                r={point.radius}
              />
              <circle cx={point.x} cy={point.y} fill='var(--color-primary-custom)' r='3' />
              <title>{`${point.label}: ${point.visitors}`}</title>
            </g>
          ))}
        </svg>

        {points.length === 0 && <div className={s.empty}>{WEB_OVERVIEW_TEXT.empty}</div>}
      </div>
    </section>
  )
}
