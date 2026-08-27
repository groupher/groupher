import { CHART_GRID_RATIOS, CHART_SIZE } from '../constant'
import {
  formatTimestamp,
  pointsToAreaPath,
  pointsToPath,
  tickIndexesFor,
  xForIndex,
} from '../helper'
import type { TAnalysisTrendsOverview } from '../spec'
import useSalon from './salon'

type TProps = {
  points: TAnalysisTrendsOverview['chart']['points']
  title: string
  viewsLabel: string
  visitsLabel: string
}

export default function TrendChart({ points, title, viewsLabel, visitsLabel }: TProps) {
  const s = useSalon()
  const hasPoints = points.length > 0
  const chartPoints = points
  const views = chartPoints.map((point) => point.views)
  const visits = chartPoints.map((point) => point.visits)
  const max = Math.max(...views, ...visits, 1)
  const tickIndexes = hasPoints ? tickIndexesFor(chartPoints.length) : []

  return (
    <div className={s.wrapper}>
      <svg
        viewBox={`0 0 ${CHART_SIZE.width} ${CHART_SIZE.height}`}
        className={s.svg}
        preserveAspectRatio='none'
        role='img'
      >
        <title>{title}</title>
        <defs>
          <linearGradient id='trendViewsFill' x1='0' x2='0' y1='0' y2='1'>
            <stop offset='5%' stopColor='var(--color-primary-custom)' stopOpacity='0.34' />
            <stop offset='95%' stopColor='var(--color-primary-custom)' stopOpacity='0.03' />
          </linearGradient>
          <linearGradient id='trendVisitsFill' x1='0' x2='0' y1='0' y2='1'>
            <stop offset='5%' stopColor='var(--color-primary-custom)' stopOpacity='0.16' />
            <stop offset='95%' stopColor='var(--color-primary-custom)' stopOpacity='0.01' />
          </linearGradient>
        </defs>

        {CHART_GRID_RATIOS.map((ratio) => (
          <line
            key={ratio}
            x1={CHART_SIZE.paddingX}
            x2={CHART_SIZE.width - CHART_SIZE.paddingX}
            y1={
              CHART_SIZE.paddingTop +
              (CHART_SIZE.height - CHART_SIZE.paddingTop - CHART_SIZE.paddingBottom) * ratio
            }
            y2={
              CHART_SIZE.paddingTop +
              (CHART_SIZE.height - CHART_SIZE.paddingTop - CHART_SIZE.paddingBottom) * ratio
            }
            stroke='currentColor'
            strokeOpacity='0.08'
          />
        ))}

        {hasPoints && (
          <>
            <path d={pointsToAreaPath(views, max)} fill='url(#trendViewsFill)' />
            <path d={pointsToAreaPath(visits, max)} fill='url(#trendVisitsFill)' />
            <path
              d={pointsToPath(views, max)}
              fill='none'
              stroke='var(--color-primary-custom)'
              strokeWidth='3'
            />
            <path
              d={pointsToPath(visits, max)}
              fill='none'
              stroke='var(--color-primary-custom)'
              strokeOpacity='0.58'
              strokeWidth='2.5'
            />
          </>
        )}
        {tickIndexes.map((index) => (
          <text
            key={index}
            x={xForIndex(index, chartPoints.length)}
            y={CHART_SIZE.height - 14}
            fill='currentColor'
            opacity='0.55'
            textAnchor={index === 0 ? 'start' : index === chartPoints.length - 1 ? 'end' : 'middle'}
            className={s.tick}
          >
            {formatTimestamp(chartPoints[index]?.timestamp ?? '0')}
          </text>
        ))}
      </svg>

      <div className={s.legend}>
        <span className={s.legendItem}>
          <span
            className={s.viewsSwatch}
            style={{ backgroundColor: 'var(--color-primary-custom)' }}
          />
          {viewsLabel}
        </span>
        <span className={s.legendItem}>
          <span
            className={s.visitsSwatch}
            style={{ backgroundColor: 'var(--color-primary-custom)' }}
          />
          {visitsLabel}
        </span>
      </div>
    </div>
  )
}
