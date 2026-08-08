import type {
  WidgetApiError,
  WidgetApiResponse,
  WidgetContentResponseData,
  WidgetContentViewRequest,
  WidgetFeedbackForm,
  WidgetFeedbackResponseData,
  WidgetHomeRequest,
  WidgetHomeResponseData,
} from './contract'

const WIDGET_API_PATH = '/api/widgets/v1'

const parsePayload = async <T>(response: Response): Promise<WidgetApiResponse<T>> => {
  const data = await response.json().catch(() => null)

  if (!data || typeof data !== 'object') {
    return {
      ok: false,
      error: 'Invalid widget API response.',
    }
  }

  if (!('ok' in data)) {
    return {
      ok: false,
      error: 'Invalid widget API response shape.',
    }
  }

  if (data.ok) {
    return data as WidgetApiResponse<T>
  }

  return data as WidgetApiError
}

const buildApiUrl = (baseUrl: string, params: Record<string, string>): string => {
  const url = new URL(WIDGET_API_PATH, baseUrl)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  return url.toString()
}

const request = async <T>(
  baseUrl: string,
  params: Record<string, string>,
  init?: RequestInit,
): Promise<WidgetApiResponse<T>> => {
  try {
    const url = buildApiUrl(baseUrl, params)
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...init,
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `Request failed with status ${response.status}`,
      }
    }

    return parsePayload<T>(response)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown request failure.',
    }
  }
}

/**
 * Fetch the Widget home summary through the future v2 REST boundary.
 */
export const fetchHomeData = async ({
  baseUrl,
  widgetKey,
  community,
  signal,
}: WidgetHomeRequest): Promise<WidgetApiResponse<WidgetHomeResponseData>> => {
  return request(
    baseUrl,
    {
      view: 'home',
      widgetKey,
      ...(community ? { community } : {}),
    },
    signal ? { signal } : undefined,
  )
}

/**
 * Fetch one bounded content view through the future v2 REST boundary.
 */
export const fetchContentData = async ({
  baseUrl,
  widgetKey,
  community,
  view,
  signal,
  limit,
}: WidgetContentViewRequest): Promise<WidgetApiResponse<WidgetContentResponseData>> => {
  const payload = await request<WidgetContentResponseData>(
    baseUrl,
    {
      view,
      widgetKey,
      ...(community ? { community } : {}),
      ...(typeof limit === 'number' ? { limit: String(limit) } : {}),
    },
    signal ? { signal } : undefined,
  )

  if (!payload.ok) return payload
  return payload
}

/**
 * Submit feedback through the future v2 REST boundary.
 */
export const submitFeedback = async ({
  baseUrl,
  widgetKey,
  community,
  title,
  body,
  context,
  signal,
}: WidgetFeedbackForm): Promise<WidgetApiResponse<WidgetFeedbackResponseData>> => {
  try {
    const url = new URL(WIDGET_API_PATH, baseUrl).toString()
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal,
      body: JSON.stringify({
        widgetKey,
        community,
        title,
        body,
        context,
      }),
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `Request failed with status ${response.status}`,
      }
    }

    return parsePayload<WidgetFeedbackResponseData>(response)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to submit feedback.',
    }
  }
}
