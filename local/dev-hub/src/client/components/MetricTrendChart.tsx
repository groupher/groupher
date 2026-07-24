import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type TMetricTrendPoint = {
  at: number
  value: number | null
  runKey: string
}

type TProps = {
  title: string
  unit: '%' | 'MB'
  points: TMetricTrendPoint[]
  threshold: number
  bucketMs: number
}

type TChartDatum = {
  at: number
  value: number | null
  criticalValue: number | null
}

export function MetricTrendChart({ title, unit, points, threshold, bucketMs }: TProps) {
  const data = buildChartData(points, threshold, bucketMs)
  const values = points.flatMap((point) => (point.value === null ? [] : [point.value]))
  const latest = values.at(-1) ?? null
  const peak = values.length > 0 ? Math.max(...values) : null
  const average =
    values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : null

  return (
    <section className='metric-chart-card'>
      <header className='metric-chart-header'>
        <div>
          <h3>{title}</h3>
          <span>{values.length > 0 ? `${values.length} samples` : 'No samples'}</span>
        </div>
        <div className='metric-chart-stats'>
          <span>
            <small>Now</small>
            <strong>{formatValue(latest, unit)}</strong>
          </span>
          <span>
            <small>Avg</small>
            <strong>{formatValue(average, unit)}</strong>
          </span>
          <span>
            <small>Peak</small>
            <strong>{formatValue(peak, unit)}</strong>
          </span>
        </div>
      </header>

      <div className='metric-chart-canvas'>
        {data.length > 0 ? (
          <ResponsiveContainer width='100%' height='100%' minWidth={0}>
            <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke='rgb(0 0 0 / 7%)' />
              <XAxis
                type='number'
                dataKey='at'
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatTime}
                tick={{ fill: '#92928d', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                width={42}
                domain={[0, 'auto']}
                tickFormatter={(value) => formatAxisValue(Number(value), unit)}
                tick={{ fill: '#92928d', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ stroke: 'rgb(0 0 0 / 18%)', strokeDasharray: '3 3' }}
                labelFormatter={(value) => formatTimestamp(Number(value))}
                formatter={(value) => [formatValue(Number(value), unit), title]}
                contentStyle={{
                  border: 0,
                  borderRadius: 8,
                  background: '#242422',
                  boxShadow: '0 12px 28px -18px rgb(0 0 0 / 55%)',
                  color: '#f2f2ed',
                  fontFamily: '"SFMono-Regular", Consolas, monospace',
                  fontSize: 11,
                }}
                labelStyle={{ color: '#aaa9a2', marginBottom: 4 }}
              />
              <ReferenceLine
                y={threshold}
                stroke='#c85a5a'
                strokeDasharray='4 4'
                strokeOpacity={0.62}
              />
              <Line
                type='monotone'
                dataKey='value'
                connectNulls={false}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                stroke='var(--service-monogram-background)'
                strokeWidth={1.8}
                isAnimationActive={false}
              />
              <Line
                type='monotone'
                dataKey='criticalValue'
                connectNulls={false}
                dot={{ r: 2.5, fill: '#dd6767', strokeWidth: 0 }}
                activeDot={{ r: 3.5, fill: '#dd6767', strokeWidth: 0 }}
                stroke='#dd6767'
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className='metric-chart-empty'>No history in this range.</div>
        )}
      </div>
    </section>
  )
}

function buildChartData(
  points: TMetricTrendPoint[],
  threshold: number,
  bucketMs: number,
): TChartDatum[] {
  const data: TChartDatum[] = []
  const gapMs = Math.max(7_000, bucketMs * 2.5)
  let previous: TMetricTrendPoint | null = null

  for (const point of points) {
    if (previous && (previous.runKey !== point.runKey || point.at - previous.at > gapMs)) {
      data.push({
        at: previous.at + Math.min(gapMs / 2, (point.at - previous.at) / 2),
        value: null,
        criticalValue: null,
      })
    }

    data.push({
      at: point.at,
      value: point.value,
      criticalValue: point.value !== null && point.value >= threshold ? point.value : null,
    })
    previous = point
  }

  return data
}

function formatTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function formatTimestamp(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value)
}

function formatAxisValue(value: number, unit: TProps['unit']): string {
  if (unit === 'MB' && value >= 1_024) return `${Math.round(value / 1_024)}G`
  return `${Math.round(value)}`
}

function formatValue(value: number | null, unit: TProps['unit']): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const precision = value < 10 ? 1 : 0
  return `${value.toFixed(precision)} ${unit}`
}
