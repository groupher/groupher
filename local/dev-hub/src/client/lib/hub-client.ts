import type {
  TGitDiffPayload,
  TGitDiffScope,
  TGitSnapshot,
  THubEvent,
  THubSnapshot,
  TMetricHistoryPayload,
  TMetricRange,
  TMetricStorageNotice,
  TPublicService,
  TServiceConfigContent,
  TServiceConfigManifest,
  TServiceLog,
  TServiceMetricsSnapshot,
  TServiceStartMode,
} from '@shared/contracts'

type TLogListener = (log: TServiceLog) => void
export type TServiceControlAction = 'start' | 'stop' | 'restart'
type THubConnectionOptions = {
  onSnapshot: (snapshot: THubSnapshot) => void
  onStatus: (service: TPublicService) => void
  onGit: (git: TGitSnapshot) => void
  onMetrics: (serviceId: string, metrics: TServiceMetricsSnapshot) => void
  onMetricNotices: (notices: TMetricStorageNotice[]) => void
  onConnectionChange: (connected: boolean) => void
}

const logListeners = new Map<string, Set<TLogListener>>()

export async function fetchSnapshot(signal?: AbortSignal): Promise<THubSnapshot> {
  const response = await fetch('/api/services', { signal })
  if (!response.ok) throw new Error('Could not load local services.')
  return (await response.json()) as THubSnapshot
}

export async function fetchGitDiff(
  scope: TGitDiffScope,
  signal?: AbortSignal,
): Promise<TGitDiffPayload> {
  const response = await fetch(`/api/git/diff?scope=${scope}`, { signal })
  const payload = (await response.json()) as TGitDiffPayload & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Could not load the Git diff.')
  return payload
}

export async function fetchServiceLogs(id: string, signal?: AbortSignal): Promise<TServiceLog[]> {
  const response = await fetch(`/api/services/${encodeURIComponent(id)}/logs`, { signal })
  if (!response.ok) throw new Error(`Could not load logs for ${id}.`)
  const payload = (await response.json()) as { logs: TServiceLog[] }
  return payload.logs
}

export async function fetchServiceConfig(
  id: string,
  signal?: AbortSignal,
): Promise<TServiceConfigManifest> {
  const response = await fetch(`/api/services/${encodeURIComponent(id)}/config`, { signal })
  const payload = (await response.json().catch(() => null)) as
    | (TServiceConfigManifest & { error?: string })
    | null
  if (!response.ok || !payload) {
    throw new Error(payload?.error || `Could not load configuration for ${id}.`)
  }
  return payload
}

export async function fetchServiceConfigContent(
  id: string,
  fileId: string,
  reveal: boolean,
  signal?: AbortSignal,
): Promise<TServiceConfigContent> {
  const params = new URLSearchParams()
  if (reveal) params.set('reveal', 'true')
  const query = params.size > 0 ? `?${params.toString()}` : ''
  const response = await fetch(
    `/api/services/${encodeURIComponent(id)}/config/${encodeURIComponent(fileId)}${query}`,
    { signal },
  )
  const payload = (await response.json().catch(() => null)) as
    | (TServiceConfigContent & { error?: string })
    | null
  if (!response.ok || !payload) {
    throw new Error(payload?.error || `Could not load configuration file for ${id}.`)
  }
  return payload
}

export async function fetchMetricHistory(
  id: string,
  range: TMetricRange,
  signal?: AbortSignal,
): Promise<TMetricHistoryPayload> {
  const params = new URLSearchParams({ range, resolution: '800' })
  const response = await fetch(
    `/api/services/${encodeURIComponent(id)}/metrics?${params.toString()}`,
    { signal },
  )
  const payload = (await response.json()) as TMetricHistoryPayload & { error?: string }
  if (!response.ok) throw new Error(payload.error || `Could not load metrics for ${id}.`)
  return payload
}

export async function controlService(
  id: string,
  action: TServiceControlAction,
  mode?: TServiceStartMode | 'default',
): Promise<TPublicService[]> {
  const response = await fetch(`/api/services/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    ...(action === 'start' && mode
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        }
      : {}),
  })
  const payload = (await response.json().catch(() => null)) as {
    service?: TPublicService
    services?: TPublicService[]
    error?: string
  } | null

  if (!response.ok || !payload?.service) {
    throw new Error(payload?.error || `Could not ${action} ${id}.`)
  }

  return payload.services || [payload.service]
}

export function connectHub(options: THubConnectionOptions): () => void {
  const source = new EventSource('/api/events')

  source.addEventListener('open', () => options.onConnectionChange(true))
  source.addEventListener('error', () => options.onConnectionChange(false))
  source.addEventListener('snapshot', (event) => {
    const snapshot = JSON.parse(event.data) as THubSnapshot
    options.onSnapshot(snapshot)
  })
  source.addEventListener('status', (event) => {
    const hubEvent = JSON.parse(event.data) as Extract<THubEvent, { type: 'status' }>
    options.onStatus(hubEvent.service)
  })
  source.addEventListener('log', (event) => {
    const hubEvent = JSON.parse(event.data) as Extract<THubEvent, { type: 'log' }>
    const listeners = logListeners.get(hubEvent.serviceId)
    if (listeners) for (const listener of listeners) listener(hubEvent.log)
  })
  source.addEventListener('git', (event) => {
    const hubEvent = JSON.parse(event.data) as Extract<THubEvent, { type: 'git' }>
    options.onGit(hubEvent.git)
  })
  source.addEventListener('metrics', (event) => {
    const hubEvent = JSON.parse(event.data) as Extract<THubEvent, { type: 'metrics' }>
    options.onMetrics(hubEvent.serviceId, hubEvent.metrics)
  })
  source.addEventListener('metric-notices', (event) => {
    const hubEvent = JSON.parse(event.data) as Extract<THubEvent, { type: 'metric-notices' }>
    options.onMetricNotices(hubEvent.notices)
  })

  return () => source.close()
}

export function subscribeServiceLogs(id: string, listener: TLogListener): () => void {
  const listeners = logListeners.get(id) || new Set<TLogListener>()
  listeners.add(listener)
  logListeners.set(id, listeners)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) logListeners.delete(id)
  }
}
