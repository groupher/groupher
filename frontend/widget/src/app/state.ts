export const WIDGET_VIEWS = ['home', 'posts', 'changelog', 'docs', 'feedback'] as const

export type WidgetView = (typeof WIDGET_VIEWS)[number]
export type WidgetPosition = 'bottom-left' | 'bottom-right'
export type WidgetDataView = Exclude<WidgetView, 'feedback'>
export type WidgetContentView = Exclude<WidgetView, 'home' | 'feedback'>

export type WidgetPageContext = {
  title?: string
  url?: string
}

export type WidgetBootConfig = {
  position?: WidgetPosition
  widgetKey: string
  mock?: boolean
}

export type WidgetListStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

export type WidgetContentItem = {
  id: string
  title: string
  digest?: string
  updatedAt?: string
  link?: string
}

export type WidgetContentState = {
  status: WidgetListStatus
  items: WidgetContentItem[]
  error?: string
}

export type WidgetHomeState = {
  status: WidgetListStatus
  posts: number
  changelog: number
  docs: number
  error?: string
}

export type WidgetFeedbackSubmitState = 'idle' | 'submitting' | 'success' | 'error'

export type WidgetFeedbackState = {
  title: string
  body: string
  status: WidgetFeedbackSubmitState
  error?: string
  resultUrl?: string
}

export type WidgetState = {
  config: WidgetBootConfig
  context: WidgetPageContext
  open: boolean
  view: WidgetView
  community: string
  home: WidgetHomeState
  posts: WidgetContentState
  changelog: WidgetContentState
  docs: WidgetContentState
  feedback: WidgetFeedbackState
}

/**
 * Create an isolated initial state for a Widget boot cycle.
 */
export const createDefaultWidgetState = (
  config: WidgetBootConfig = { widgetKey: '' },
): WidgetState => ({
  config,
  context: {},
  open: false,
  view: 'home',
  community: '',
  home: {
    status: 'idle',
    posts: 0,
    changelog: 0,
    docs: 0,
  },
  posts: {
    status: 'idle',
    items: [],
  },
  changelog: {
    status: 'idle',
    items: [],
  },
  docs: {
    status: 'idle',
    items: [],
  },
  feedback: {
    title: '',
    body: '',
    status: 'idle',
  },
})

/**
 * Resolve the demo community slug encoded in a public Widget key.
 */
export const resolveCommunityFromWidgetKey = (widgetKey: string): string => {
  const key = widgetKey.trim().toLowerCase()
  const stripped = key
    .replace(/^widget[_-](public[_-])?/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')

  if (stripped && /^[a-z0-9-]+$/.test(stripped)) {
    return stripped
  }

  return ''
}

/**
 * Narrow an untyped command payload to a supported Widget view.
 */
export const isWidgetView = (value: unknown): value is WidgetView =>
  typeof value === 'string' && WIDGET_VIEWS.includes(value as WidgetView)
