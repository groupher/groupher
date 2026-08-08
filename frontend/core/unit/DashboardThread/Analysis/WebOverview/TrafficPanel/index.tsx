'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from 'urql'

import {
  TRAFFIC_GRID_TEMPLATE,
  TRAFFIC_HOURS,
  TRAFFIC_WEEKDAYS,
  WEB_OVERVIEW_TEXT,
} from '../constant'
import { hourLabel } from '../helper'
import { ANALYSIS_TREND_TRAFFIC_QUERY } from '../schema'
import type { TAnalysisTrendTrafficSection, TAnalysisWebOverviewDemo } from '../spec'
import useSalon from './salon'

type TProps = {
  community: string
  days: number
  demoData?: TAnalysisWebOverviewDemo
}

type TData = {
  analysisTrendTraffic: TAnalysisTrendTrafficSection | null
}

const demoTrafficSection = (demoData: TAnalysisWebOverviewDemo): TAnalysisTrendTrafficSection => ({
  status: demoData.traffic.status,
  timezone: demoData.traffic.timezone,
  cells: demoData.traffic.cells ?? [],
  error: demoData.traffic.error,
})

export default function TrafficPanel({ community, days, demoData }: TProps) {
  const s = useSalon()
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  const isDemo = Boolean(demoData)

  const [result] = useQuery<TData>({
    query: ANALYSIS_TREND_TRAFFIC_QUERY,
    variables: { community, days },
    pause: !visible || isDemo,
    requestPolicy: 'cache-and-network',
  })
  const section =
    isDemo && demoData ? demoTrafficSection(demoData) : result.data?.analysisTrendTraffic
  const cells = section?.cells ?? []
  const max = Math.max(...cells.map((cell) => cell.visitors), 1)
  const cellsByKey = useMemo(
    () => new Map(cells.map((cell) => [`${cell.weekday}:${cell.hour}`, cell])),
    [cells],
  )

  useEffect(() => {
    const node = ref.current
    if (!node || visible) return
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '240px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  return (
    <section ref={ref} className={s.wrapper}>
      <h3 className={s.title}>{WEB_OVERVIEW_TEXT.traffic}</h3>

      {!isDemo && (!visible || (result.fetching && !section)) ? (
        <div className={s.state}>Loading analytics…</div>
      ) : !isDemo && result.error ? (
        <div className={s.error}>{result.error?.message}</div>
      ) : section?.error ? (
        <div className={s.error}>{section.error.message}</div>
      ) : cells.length === 0 ? (
        <div className={s.state}>{WEB_OVERVIEW_TEXT.empty}</div>
      ) : (
        <div className={s.grid} style={{ gridTemplateColumns: TRAFFIC_GRID_TEMPLATE }}>
          <span />
          {TRAFFIC_WEEKDAYS.map((weekday) => (
            <span key={weekday} className={s.weekday}>
              {weekday}
            </span>
          ))}

          {TRAFFIC_HOURS.map((hour) => (
            <Fragment key={hour}>
              <span key={`label-${hour}`} className={s.hour}>
                {hourLabel(hour)}
              </span>
              {TRAFFIC_WEEKDAYS.map((_weekday, weekday) => {
                const cell = cellsByKey.get(`${weekday}:${hour}`)
                const ratio = (cell?.visitors ?? 0) / max

                return (
                  <span key={`${TRAFFIC_WEEKDAYS[weekday]}-${hourLabel(hour)}`} className={s.cell}>
                    <span
                      className={s.dot(ratio > 0)}
                      style={
                        ratio > 0
                          ? {
                              backgroundColor: 'var(--color-primary-custom)',
                              opacity: Math.max(0.18, ratio),
                            }
                          : undefined
                      }
                      title={`${TRAFFIC_WEEKDAYS[weekday]} ${hourLabel(hour)}: ${cell?.visitors ?? 0}`}
                    />
                  </span>
                )
              })}
            </Fragment>
          ))}
        </div>
      )}
    </section>
  )
}
