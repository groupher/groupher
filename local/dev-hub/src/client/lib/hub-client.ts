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
  TServiceEnvironment,
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

const readResponseError = async (response: Response, fallback: string): Promise<Error> => {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(payload?.error || `${fallback} (HTTP ${response.status})`)
}

async function mutationHeaders(): Promise<Record<string, string>> {
  const response = await fetch('/api/identity', { cache: 'no-store' })
  if (!response.ok) throw new Error('Could not verify the Dev Hub identity.')
  const identity = (await response.json()) as { instanceId?: unknown; apiVersion?: unknown }
  if (identity.apiVersion === 1 && typeof identity.instanceId === 'string' && identity.instanceId) {
    return { 'X-Groupher-Instance-Id': identity.instanceId }
  }
  if (identity.apiVersion !== undefined || identity.instanceId !== undefined) {
    throw new Error('The Dev Hub returned an invalid instance identity.')
  }
  return {}
}

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
  if (!response.ok) throw await readResponseError(response, 'Could not load the Git diff.')
  return (await response.json()) as TGitDiffPayload
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
  if (!response.ok)
    throw await readResponseError(response, `Could not load configuration for ${id}.`)
  const payload = (await response.json().catch(() => null)) as TServiceConfigManifest | null
  if (!payload) throw new Error(`Could not load configuration for ${id}.`)
  return payload
}

export async function fetchServiceEnvironment(
  id: string,
  signal?: AbortSignal,
): Promise<TServiceEnvironment> {
  const response = await fetch(`/api/services/${encodeURIComponent(id)}/environment`, { signal })
  if (!response.ok) throw await readResponseError(response, 'Could not load local environment.')
  return response.json() as Promise<TServiceEnvironment>
}

export async function saveServiceEnvironment(
  id: string,
  changes: Record<string, string | null>,
): Promise<TServiceEnvironment> {
  const response = await fetch(`/api/services/${encodeURIComponent(id)}/environment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await mutationHeaders()) },
    body: JSON.stringify({ changes }),
  })
  if (!response.ok) throw await readResponseError(response, 'Could not save local environment.')
  return response.json() as Promise<TServiceEnvironment>
}

export async function fetchServiceConfigContent(
  id: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<TServiceConfigContent> {
  const response = await fetch(
    `/api/services/${encodeURIComponent(id)}/config/${encodeURIComponent(fileId)}`,
    { signal },
  )
  if (!response.ok)
    throw await readResponseError(response, `Could not load configuration file for ${id}.`)
  const payload = (await response.json().catch(() => null)) as TServiceConfigContent | null
  if (!payload) throw new Error(`Could not load configuration file for ${id}.`)
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
  if (!response.ok) throw await readResponseError(response, `Could not load metrics for ${id}.`)
  return (await response.json()) as TMetricHistoryPayload
}

export async function controlService(
  id: string,
  action: TServiceControlAction,
  mode?: TServiceStartMode | 'default',
): Promise<TPublicService[]> {
  const response = await fetch(`/api/services/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    headers: {
      ...(await mutationHeaders()),
      ...(action === 'start' && mode ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(action === 'start' && mode
      ? {
          body: JSON.stringify({ mode }),
        }
      : {}),
  })
  if (!response.ok) throw await readResponseError(response, `Could not ${action} ${id}.`)
  const payload = (await response.json().catch(() => null)) as {
    service?: TPublicService
    services?: TPublicService[]
  } | null
  if (!payload?.service) throw new Error(`Could not ${action} ${id}.`)

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
