import type { TTransKey } from '~/spec'

export type TAnalysisWebRange = {
  days: number
  startAt: string
  endAt: string
  bucket: 'hour' | 'day'
}

export type TAnalysisWebMetric = {
  value: number
  previousValue: number | null
  changeRate: number | null
}

export type TSummaryMetricSpec = {
  key: keyof TAnalysisTrendsOverview['summary']
  label: TTransKey
}

export type TSummaryMetricItem = TSummaryMetricSpec & {
  changeRate: number | null
  value: string
}

export type TAnalysisWebCountMetrics = {
  visitors: number
  visits: number
  views: number
}

export type TAnalysisWebDimensionMetrics = TAnalysisWebCountMetrics & {
  percentage: number
}

export type TAnalysisWebPageMetrics = TAnalysisWebCountMetrics & {
  bounceRate: number | null
  visitDuration: number | null
}

export type TAnalysisWebDimension<TMetrics> = {
  value: string
  label: string
  metrics: TMetrics
}

export type TAnalysisWebLocationDimension<TMetrics> = TAnalysisWebDimension<TMetrics> & {
  code: string | null
}

export type TAnalysisWebError = {
  code: string
  message: string
  section: string
  providerStatus: string | null
}

export type TAnalysisTrendsOverview = {
  status: 'ok' | 'partial' | 'unavailable'
  provider: string
  range: TAnalysisWebRange
  summary: {
    pageviews: TAnalysisWebMetric
    visitors: TAnalysisWebMetric
    visits: TAnalysisWebMetric
    bounceRate: TAnalysisWebMetric
    visitDuration: TAnalysisWebMetric
  }
  chart: {
    bucket: 'hour' | 'day'
    points: {
      bucket?: 'hour' | 'day'
      timestamp: string
      visits: number
      views: number
    }[]
  }
  errors: TAnalysisWebError[]
}

export type TAnalysisTrendSection<TItem> = {
  status: 'ok' | 'unavailable'
  items: TItem[]
  error: TAnalysisWebError | null
}

export type TAnalysisTrendPagesSection = TAnalysisTrendSection<
  TAnalysisWebDimension<TAnalysisWebPageMetrics>
>

export type TAnalysisTrendSourcesSection = TAnalysisTrendSection<
  TAnalysisWebDimension<TAnalysisWebCountMetrics>
>

export type TAnalysisTrendEnvironmentSection = TAnalysisTrendSection<
  TAnalysisWebDimension<TAnalysisWebDimensionMetrics>
>

export type TAnalysisTrendLocationSection = TAnalysisTrendSection<
  TAnalysisWebLocationDimension<TAnalysisWebDimensionMetrics>
>

export type TAnalysisTrendTrafficSection = {
  status: 'ok' | 'unavailable'
  timezone: string
  cells: {
    weekday: number
    hour: number
    visitors: number
    visits: number
    views: number
  }[]
  error: TAnalysisWebError | null
}

// Temporary development fixture shape. Production Trends receives only the
// SSR overview above; lower panels load their own section DTOs after hydration.
export type TAnalysisWebOverview = TAnalysisTrendsOverview & Record<string, unknown>

export type TAnalysisDemoPages = {
  path: TAnalysisWebDimension<TAnalysisWebPageMetrics>[]
  url: TAnalysisWebDimension<TAnalysisWebPageMetrics>[]
  entry: TAnalysisWebDimension<TAnalysisWebPageMetrics>[]
  exit: TAnalysisWebDimension<TAnalysisWebPageMetrics>[]
  title: TAnalysisWebDimension<TAnalysisWebPageMetrics>[]
  query: TAnalysisWebDimension<TAnalysisWebPageMetrics>[]
}

export type TAnalysisDemoSources = {
  referrer: TAnalysisWebDimension<TAnalysisWebCountMetrics>[]
  channel: TAnalysisWebDimension<TAnalysisWebCountMetrics>[]
  domain: TAnalysisWebDimension<TAnalysisWebCountMetrics>[]
}

export type TAnalysisDemoEnvironment = {
  browser: TAnalysisWebDimension<TAnalysisWebDimensionMetrics>[]
  os: TAnalysisWebDimension<TAnalysisWebDimensionMetrics>[]
  device: TAnalysisWebDimension<TAnalysisWebDimensionMetrics>[]
  language: TAnalysisWebDimension<TAnalysisWebDimensionMetrics>[]
  screen: TAnalysisWebDimension<TAnalysisWebDimensionMetrics>[]
}

export type TAnalysisDemoLocation = {
  country: TAnalysisWebLocationDimension<TAnalysisWebDimensionMetrics>[]
  region: TAnalysisWebLocationDimension<TAnalysisWebDimensionMetrics>[]
  city: TAnalysisWebLocationDimension<TAnalysisWebDimensionMetrics>[]
}

export type TAnalysisDemoTraffic = {
  status: 'ok' | 'unavailable'
  timezone: string
  cells: {
    weekday: number
    hour: number
    visitors: number
    visits: number
    views: number
  }[]
  error: TAnalysisWebError | null
}

export type TAnalysisWebOverviewDemo = TAnalysisWebOverview & {
  pages: TAnalysisDemoPages
  sources: TAnalysisDemoSources
  environment: TAnalysisDemoEnvironment
  location: TAnalysisDemoLocation
  traffic: TAnalysisDemoTraffic
}
