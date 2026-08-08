import type { WidgetContentView, WidgetFeedbackSubmitState } from '../app/state'

export type WidgetApiStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

export type WidgetDataItem = {
  id: string
  title: string
  digest?: string
  updatedAt?: string
  link?: string
}

export type WidgetHomePayload = {
  posts: number
  changelog: number
  docs: number
}

export type WidgetHomeResponseData = {
  view: 'home'
  community: string
  counts: WidgetHomePayload
}

export type WidgetContentResponseData = {
  view: WidgetContentView
  community: string
  items: WidgetDataItem[]
}

export type WidgetFeedbackSubmitResult = {
  id: string
  title: string
  link: string
}

export type WidgetFeedbackResponseData = {
  view: 'feedback'
  community: string
  result: WidgetFeedbackSubmitResult
}

export type WidgetApiError = {
  ok: false
  error: string
}

export type WidgetApiResponse<T = unknown> =
  | WidgetApiError
  | ({ ok: true; data: T } & {
      error?: never
    })

export type WidgetContentApiResponse = WidgetApiResponse<
  WidgetHomeResponseData | WidgetContentResponseData
>

export type WidgetContentViewRequest = {
  baseUrl: string
  widgetKey: string
  community?: string
  view: WidgetContentView
  signal?: AbortSignal
  limit?: number
}

export type WidgetHomeRequest = Omit<WidgetContentViewRequest, 'view' | 'limit'>

export type WidgetFeedbackForm = {
  baseUrl: string
  widgetKey: string
  community: string
  title: string
  body: string
  signal?: AbortSignal
  status?: WidgetFeedbackSubmitState
  context?: {
    title?: string
    url?: string
  }
}
