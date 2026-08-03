import { prettyNum } from '~/fmt'

import type { TAnalysisWebOverview } from '../helper'

type TProps = {
  emptyLabel: string
  peakLabel: string
  points: TAnalysisWebOverview['timeseries']['points']
  title: string
  viewsLabel: string
  visitsLabel: string
}

const WIDTH = 720
const HEIGHT = 220
const PADDING = 24

const pointsToPath = (values: number[]): string => {
  if (values.length === 0) return ''

  const max = Math.max(...values, 1)
  const step = values.length > 1 ? (WIDTH - PADDING * 2) / (values.length - 1) : 0

  return values
    .map((value, index) => {
      const x = PADDING + step * index
      const y = HEIGHT - PADDING - (value / max) * (HEIGHT - PADDING * 2)

      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

export default function TrendChart({
  emptyLabel,
  peakLabel,
  points,
  title,
  viewsLabel,
  visitsLabel,
}: TProps) {
  if (points.length === 0) {
    return (
      <div className='border-alphathin text-digest center h-64 rounded-md border text-sm'>
        {emptyLabel}
      </div>
    )
  }

  const views = points.map((point) => point.views)
  const visits = points.map((point) => point.visits)
  const max = Math.max(...views, ...visits, 1)

  return (
    <div className='border-alphathin rounded-md border p-4'>
      <div className='row-between mb-3'>
        <h3 className='text-title text-base'>{title}</h3>
        <div className='text-digest text-xs'>
          {prettyNum(max)}
          {peakLabel ? ` ${peakLabel}` : ''}
        </div>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className='h-64 w-full' role='img'>
        <title>{title}</title>
        <path d={pointsToPath(views)} fill='none' stroke='currentColor' strokeWidth='3' />
        <path
          d={pointsToPath(visits)}
          fill='none'
          stroke='currentColor'
          strokeOpacity='0.35'
          strokeWidth='3'
        />
      </svg>
      <div className='row-center text-digest gap-x-4 text-xs'>
        <span>{viewsLabel}</span>
        <span>{visitsLabel}</span>
      </div>
    </div>
  )
}
