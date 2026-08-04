'use client'

import { Fragment, useMemo } from 'react'

import {
  TRAFFIC_GRID_TEMPLATE,
  TRAFFIC_HOURS,
  TRAFFIC_WEEKDAYS,
  WEB_OVERVIEW_TEXT,
} from '../constant'
import { hourLabel } from '../helper'
import type { TAnalysisWebOverview } from '../spec'
import useSalon from './salon'

type TProps = {
  cells: TAnalysisWebOverview['traffic']['cells']
}

export default function TrafficPanel({ cells }: TProps) {
  const s = useSalon()
  const max = Math.max(...cells.map((cell) => cell.visitors), 1)
  const cellsByKey = useMemo(() => {
    return new Map(cells.map((cell) => [`${cell.weekday}:${cell.hour}`, cell]))
  }, [cells])

  return (
    <section className={s.wrapper}>
      <h3 className={s.title}>{WEB_OVERVIEW_TEXT.traffic}</h3>

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
    </section>
  )
}
