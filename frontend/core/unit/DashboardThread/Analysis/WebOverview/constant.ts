import type { TAnalysisTrendsOverview, TAnalysisWebMetric, TAnalysisWebOverview } from './spec'
import type { TSummaryMetricSpec } from './spec'

export const CHART_SIZE = {
  width: 720,
  height: 260,
  paddingX: 0,
  paddingTop: 24,
  paddingBottom: 42,
}

export const CHART_GRID_RATIOS = [0.25, 0.5, 0.75]
export const TRAFFIC_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const TRAFFIC_HOURS = Array.from({ length: 24 }, (_, hour) => hour)
export const TRAFFIC_GRID_TEMPLATE = '2.5rem repeat(7, minmax(1.25rem, 1fr))'
export const DIMENSION_ROW_LIMIT = 4

export const WEB_OVERVIEW_TRANS = {
  empty: 'dsb.analysis.empty',
  unavailable: 'dsb.analysis.unavailable',
  trend: 'dsb.menu.trend',
  pageviews: 'dsb.analysis.pageviews',
  visits: 'dsb.analysis.visits',
} as const

export const WEB_OVERVIEW_TEXT = {
  empty: 'No data yet.',
  pages: 'Pages',
  path: 'Path',
  url: 'URL',
  entryPage: 'Entry page',
  exitPage: 'Exit page',
  sources: 'Sources',
  referrers: 'Referrers',
  channels: 'Channels',
  domains: 'Domains',
  environment: 'Environment',
  browsers: 'Browsers',
  os: 'OS',
  devices: 'Devices',
  location: 'Location',
  countries: 'Countries',
  regions: 'Regions',
  cities: 'Cities',
  traffic: 'Traffic',
}

export const SUMMARY_ITEMS: TSummaryMetricSpec[] = [
  { key: 'pageviews', label: 'dsb.analysis.pageviews' },
  { key: 'visitors', label: 'dsb.analysis.visitors' },
  { key: 'visits', label: 'dsb.analysis.visits' },
  { key: 'bounceRate', label: 'dsb.analysis.bounces' },
  { key: 'visitDuration', label: 'dsb.analysis.total_time' },
]

const metric = (
  value: number,
  previousValue: number | null = null,
  changeRate: number | null = null,
): TAnalysisWebMetric => ({
  value,
  previousValue,
  changeRate,
})

const demoTimestamp = (month: number, day: number): string => String(Date.UTC(2026, month, day))

export const DEMO_POINTS: TAnalysisTrendsOverview['chart']['points'] = [
  { bucket: 'day', timestamp: demoTimestamp(3, 5), visitors: 18, visits: 24, views: 42 },
  { bucket: 'day', timestamp: demoTimestamp(3, 10), visitors: 24, visits: 31, views: 58 },
  { bucket: 'day', timestamp: demoTimestamp(3, 15), visitors: 21, visits: 28, views: 46 },
  { bucket: 'day', timestamp: demoTimestamp(3, 20), visitors: 35, visits: 43, views: 82 },
  { bucket: 'day', timestamp: demoTimestamp(3, 25), visitors: 29, visits: 39, views: 64 },
  { bucket: 'day', timestamp: demoTimestamp(3, 30), visitors: 42, visits: 51, views: 96 },
  { bucket: 'day', timestamp: demoTimestamp(4, 5), visitors: 38, visits: 48, views: 86 },
  { bucket: 'day', timestamp: demoTimestamp(4, 10), visitors: 49, visits: 58, views: 118 },
  { bucket: 'day', timestamp: demoTimestamp(4, 15), visitors: 40, visits: 52, views: 92 },
  { bucket: 'day', timestamp: demoTimestamp(4, 20), visitors: 34, visits: 44, views: 76 },
  { bucket: 'day', timestamp: demoTimestamp(4, 25), visitors: 52, visits: 67, views: 136 },
  { bucket: 'day', timestamp: demoTimestamp(4, 30), visitors: 47, visits: 61, views: 121 },
  { bucket: 'day', timestamp: demoTimestamp(5, 5), visitors: 56, visits: 74, views: 148 },
  { bucket: 'day', timestamp: demoTimestamp(5, 10), visitors: 61, visits: 82, views: 166 },
  { bucket: 'day', timestamp: demoTimestamp(5, 15), visitors: 54, visits: 71, views: 139 },
  { bucket: 'day', timestamp: demoTimestamp(5, 20), visitors: 69, visits: 88, views: 184 },
  { bucket: 'day', timestamp: demoTimestamp(5, 25), visitors: 63, visits: 84, views: 172 },
  { bucket: 'day', timestamp: demoTimestamp(5, 30), visitors: 72, visits: 96, views: 198 },
]

export const DEMO_OVERVIEW: TAnalysisWebOverview = {
  status: 'ok',
  provider: 'demo',
  pathScope: '/home',
  range: {
    days: 90,
    startAt: demoTimestamp(3, 1),
    endAt: String(Date.UTC(2026, 5, 30, 23, 59, 59)),
    bucket: 'day',
  },
  summary: {
    pageviews: metric(2156, 1890, 14),
    visitors: metric(824, 760, 8.4),
    visits: metric(1138, 1024, 11.1),
    bounceRate: metric(0.34, 0.39, -12.8),
    visitDuration: metric(246, 218, 12.8),
  },
  chart: { bucket: 'day', points: DEMO_POINTS },
  pages: {
    status: 'ok',
    path: [
      {
        value: '/home/post',
        label: '/home/post',
        metrics: { visitors: 312, visits: 420, views: 796, bounceRate: 0.28, visitDuration: 265 },
      },
      {
        value: '/home/docs',
        label: '/home/docs',
        metrics: { visitors: 198, visits: 276, views: 512, bounceRate: 0.31, visitDuration: 318 },
      },
      {
        value: '/home/changelog',
        label: '/home/changelog',
        metrics: { visitors: 146, visits: 203, views: 368, bounceRate: 0.36, visitDuration: 204 },
      },
    ],
    url: [
      {
        value: 'https://groupher.com/home/post',
        label: '/home/post',
        metrics: { visitors: 312, visits: 420, views: 796, bounceRate: 0.28, visitDuration: 265 },
      },
      {
        value: 'https://groupher.com/home/docs',
        label: '/home/docs',
        metrics: { visitors: 198, visits: 276, views: 512, bounceRate: 0.31, visitDuration: 318 },
      },
    ],
    entry: [
      { value: '/home', label: '/home', metrics: { visitors: 352, visits: 468, views: 860 } },
      {
        value: '/home/post',
        label: '/home/post',
        metrics: { visitors: 194, visits: 260, views: 488 },
      },
    ],
    exit: [
      {
        value: '/home/post',
        label: '/home/post',
        metrics: { visitors: 176, visits: 242, views: 420 },
      },
      {
        value: '/home/docs',
        label: '/home/docs',
        metrics: { visitors: 118, visits: 172, views: 304 },
      },
    ],
    title: [
      {
        value: 'Posts',
        label: 'Posts',
        metrics: { visitors: 312, visits: 420, views: 796, bounceRate: 0.28, visitDuration: 265 },
      },
      {
        value: 'Docs',
        label: 'Docs',
        metrics: { visitors: 198, visits: 276, views: 512, bounceRate: 0.31, visitDuration: 318 },
      },
    ],
    query: [
      {
        value: 'source=github',
        label: 'source=github',
        metrics: { visitors: 82, visits: 118, views: 236 },
      },
      { value: 'ref=docs', label: 'ref=docs', metrics: { visitors: 56, visits: 78, views: 144 } },
    ],
  },
  sources: {
    status: 'ok',
    referrer: [
      { value: 'direct', label: 'Direct', metrics: { visitors: 356, visits: 492, views: 940 } },
      { value: 'google', label: 'Google', metrics: { visitors: 214, visits: 288, views: 536 } },
      { value: 'github', label: 'GitHub', metrics: { visitors: 128, visits: 182, views: 344 } },
    ],
    channel: [
      { value: 'direct', label: 'Direct', metrics: { visitors: 356, visits: 492, views: 940 } },
      { value: 'search', label: 'Search', metrics: { visitors: 214, visits: 288, views: 536 } },
      { value: 'social', label: 'Social', metrics: { visitors: 128, visits: 182, views: 344 } },
    ],
    domain: [
      {
        value: 'groupher.com',
        label: 'groupher.com',
        metrics: { visitors: 286, visits: 388, views: 712 },
      },
      {
        value: 'github.com',
        label: 'github.com',
        metrics: { visitors: 128, visits: 182, views: 344 },
      },
      {
        value: 'google.com',
        label: 'google.com',
        metrics: { visitors: 96, visits: 124, views: 226 },
      },
    ],
  },
  environment: {
    status: 'ok',
    browser: [
      {
        value: 'Chrome',
        label: 'Chrome',
        metrics: { visitors: 536, visits: 724, views: 1388, percentage: 0.65 },
      },
      {
        value: 'Safari',
        label: 'Safari',
        metrics: { visitors: 188, visits: 246, views: 472, percentage: 0.23 },
      },
      {
        value: 'Firefox',
        label: 'Firefox',
        metrics: { visitors: 64, visits: 92, views: 188, percentage: 0.08 },
      },
    ],
    os: [
      {
        value: 'macOS',
        label: 'macOS',
        metrics: { visitors: 412, visits: 568, views: 1086, percentage: 0.5 },
      },
      {
        value: 'iOS',
        label: 'iOS',
        metrics: { visitors: 218, visits: 282, views: 514, percentage: 0.26 },
      },
      {
        value: 'Windows',
        label: 'Windows',
        metrics: { visitors: 126, visits: 174, views: 332, percentage: 0.15 },
      },
    ],
    device: [
      {
        value: 'desktop',
        label: 'Desktop',
        metrics: { visitors: 558, visits: 754, views: 1442, percentage: 0.68 },
      },
      {
        value: 'mobile',
        label: 'Mobile',
        metrics: { visitors: 242, visits: 334, views: 642, percentage: 0.29 },
      },
      {
        value: 'tablet',
        label: 'Tablet',
        metrics: { visitors: 24, visits: 50, views: 72, percentage: 0.03 },
      },
    ],
    language: [
      {
        value: 'en-US',
        label: 'English',
        metrics: { visitors: 482, visits: 650, views: 1236, percentage: 0.58 },
      },
      {
        value: 'zh-CN',
        label: 'Chinese',
        metrics: { visitors: 266, visits: 374, views: 718, percentage: 0.32 },
      },
    ],
    screen: [
      {
        value: '1512x982',
        label: '1512x982',
        metrics: { visitors: 218, visits: 312, views: 596, percentage: 0.26 },
      },
      {
        value: '390x844',
        label: '390x844',
        metrics: { visitors: 176, visits: 238, views: 456, percentage: 0.21 },
      },
    ],
  },
  location: {
    status: 'ok',
    country: [
      {
        value: 'US',
        label: 'United States',
        code: 'US',
        metrics: { visitors: 318, visits: 438, views: 846, percentage: 0.39 },
      },
      {
        value: 'CN',
        label: 'China',
        code: 'CN',
        metrics: { visitors: 266, visits: 374, views: 718, percentage: 0.32 },
      },
      {
        value: 'JP',
        label: 'Japan',
        code: 'JP',
        metrics: { visitors: 84, visits: 112, views: 226, percentage: 0.1 },
      },
    ],
    region: [
      {
        value: 'California',
        label: 'California',
        code: null,
        metrics: { visitors: 164, visits: 224, views: 432, percentage: 0.2 },
      },
      {
        value: 'Shanghai',
        label: 'Shanghai',
        code: null,
        metrics: { visitors: 132, visits: 188, views: 356, percentage: 0.16 },
      },
    ],
    city: [
      {
        value: 'San Francisco',
        label: 'San Francisco',
        code: null,
        metrics: { visitors: 96, visits: 138, views: 268, percentage: 0.12 },
      },
      {
        value: 'Shanghai',
        label: 'Shanghai',
        code: null,
        metrics: { visitors: 92, visits: 128, views: 246, percentage: 0.11 },
      },
    ],
  },
  traffic: {
    status: 'ok',
    timezone: 'UTC',
    cells: Array.from({ length: 7 * 24 }, (_, index) => {
      const weekday = index % 7
      const hour = Math.floor(index / 7)
      const active = hour >= 8 && hour <= 20
      const visitors = active ? Math.max(0, Math.round((weekday + 1) * (hour % 6) * 0.8)) : 0

      return { weekday, hour, visitors, visits: visitors + 1, views: visitors * 2 }
    }),
  },
  errors: [],
}
