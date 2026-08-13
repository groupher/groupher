import { prettyNum } from '~/fmt'

import { CHART_SIZE } from './constant'
import type {
  TAnalysisTrendsOverview,
  TAnalysisWebCountMetrics,
  TAnalysisWebDimensionMetrics,
  TAnalysisWebMetric,
} from './spec'

const dateFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

/** Reports whether use demo data at the frontend shared boundary. */
export const shouldUseDemoData = (data: TAnalysisTrendsOverview): boolean => {
  if (process.env.NODE_ENV === 'production') return false

  return data.status === 'unavailable' || data.chart.points.length === 0
}

/** Runs the format metric operation at the frontend shared boundary. */
export const formatMetric = (metric: TAnalysisWebMetric): string => prettyNum(metric.value)
/** Runs the format percent operation at the frontend shared boundary. */
export const formatPercent = (metric: TAnalysisWebMetric): string =>
  `${Math.round(metric.value * 100)}%`

/** Runs the format duration operation at the frontend shared boundary. */
export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  if (seconds < 60) return `${Math.round(seconds)}s`

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h`

  return `${Math.round(hours / 24)}d`
}

/** Runs the format timestamp operation at the frontend shared boundary. */
export const formatTimestamp = (timestamp: string): string =>
  dateFormatter.format(new Date(Number(timestamp)))

/** Runs the hour label operation at the frontend shared boundary. */
export const hourLabel = (hour: number): string => {
  if (hour === 0) return '12am'
  if (hour < 12) return `${hour}am`
  if (hour === 12) return '12pm'

  return `${hour - 12}pm`
}

/** Runs the x for index operation at the frontend shared boundary. */
export const xForIndex = (index: number, count: number): number => {
  const step = count > 1 ? (CHART_SIZE.width - CHART_SIZE.paddingX * 2) / (count - 1) : 0

  return CHART_SIZE.paddingX + step * index
}

/** Runs the y for value operation at the frontend shared boundary. */
export const yForValue = (value: number, max: number): number =>
  CHART_SIZE.height -
  CHART_SIZE.paddingBottom -
  (value / max) * (CHART_SIZE.height - CHART_SIZE.paddingTop - CHART_SIZE.paddingBottom)

/** Runs the points to path operation at the frontend shared boundary. */
export const pointsToPath = (values: number[], max: number): string => {
  if (values.length === 0) return ''

  return values
    .map((value, index) => {
      return `${index === 0 ? 'M' : 'L'} ${xForIndex(index, values.length)} ${yForValue(value, max)}`
    })
    .join(' ')
}

/** Runs the points to area path operation at the frontend shared boundary. */
export const pointsToAreaPath = (values: number[], max: number): string => {
  if (values.length === 0) return ''

  const linePath = pointsToPath(values, max)
  const firstX = xForIndex(0, values.length)
  const lastX = xForIndex(values.length - 1, values.length)
  const baseY = CHART_SIZE.height - CHART_SIZE.paddingBottom

  return `${linePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`
}

/** Runs the tick indexes for operation at the frontend shared boundary. */
export const tickIndexesFor = (count: number): number[] => {
  if (count <= 1) return [0]

  return [0, Math.floor((count - 1) / 3), Math.floor(((count - 1) * 2) / 3), count - 1]
}

/** Runs the percentage of operation at the frontend shared boundary. */
export const percentageOf = (
  metrics: TAnalysisWebCountMetrics | TAnalysisWebDimensionMetrics,
): number | null => {
  if (!('percentage' in metrics)) return null

  return Math.round(metrics.percentage * 100)
}
