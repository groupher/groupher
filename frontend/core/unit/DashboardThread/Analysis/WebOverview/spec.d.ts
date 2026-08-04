import type { TTransKey } from '~/spec'

export type TAnalysisWebMetric = {
  value: number
  previousValue: number | null
  changeRate: number | null
}

export type TSummaryMetricSpec = {
  key: keyof TAnalysisWebOverview['summary']
  label: TTransKey
}

export type TSummaryMetricItem = TSummaryMetricSpec & {
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
  bounceRate: number
  visitDuration: number
}

export type TAnalysisWebDimension<TMetrics> = {
  value: string
  label: string
  metrics: TMetrics
}

export type TAnalysisWebLocationDimension<TMetrics> = TAnalysisWebDimension<TMetrics> & {
  code: string | null
}

export type TAnalysisWebOverview = {
  status: string
  provider: string
  pathScope: string
  range: {
    days: number
    startAt: string
    endAt: string
    bucket: string
  }
  summary: {
    pageviews: TAnalysisWebMetric
    visitors: TAnalysisWebMetric
    visits: TAnalysisWebMetric
    bounceRate: TAnalysisWebMetric
    visitDuration: TAnalysisWebMetric
  }
  timeseries: {
    status: string
    bucket: string
    points: {
      bucket: string
      timestamp: string
      visitors: number
      visits: number
      views: number
    }[]
  }
  pages: {
    status: string
    path: TAnalysisWebDimension<TAnalysisWebPageMetrics>[]
    url: TAnalysisWebDimension<TAnalysisWebPageMetrics>[]
    entry: TAnalysisWebDimension<TAnalysisWebCountMetrics>[]
    exit: TAnalysisWebDimension<TAnalysisWebCountMetrics>[]
    title: TAnalysisWebDimension<TAnalysisWebPageMetrics>[]
    query: TAnalysisWebDimension<TAnalysisWebCountMetrics>[]
  }
  sources: {
    status: string
    referrer: TAnalysisWebDimension<TAnalysisWebCountMetrics>[]
    channel: TAnalysisWebDimension<TAnalysisWebCountMetrics>[]
    domain: TAnalysisWebDimension<TAnalysisWebCountMetrics>[]
  }
  environment: {
    status: string
    browser: TAnalysisWebDimension<TAnalysisWebDimensionMetrics>[]
    os: TAnalysisWebDimension<TAnalysisWebDimensionMetrics>[]
    device: TAnalysisWebDimension<TAnalysisWebDimensionMetrics>[]
    language: TAnalysisWebDimension<TAnalysisWebDimensionMetrics>[]
    screen: TAnalysisWebDimension<TAnalysisWebDimensionMetrics>[]
  }
  location: {
    status: string
    country: TAnalysisWebLocationDimension<TAnalysisWebDimensionMetrics>[]
    region: TAnalysisWebLocationDimension<TAnalysisWebDimensionMetrics>[]
    city: TAnalysisWebLocationDimension<TAnalysisWebDimensionMetrics>[]
  }
  traffic: {
    status: string
    timezone: string
    cells: {
      weekday: number
      hour: number
      visitors: number
      visits: number
      views: number
    }[]
  }
  errors: {
    code: string
    message: string
    section: string
    providerStatus: string | null
  }[]
}
