export type Probe = {
  id: string
  label: string
  group: 'Platform' | 'Applications'
  binding: keyof ProbeBindings
  url: string
  service?: string
}

export type ProbeBindings = {
  EDGE_ROUTER: Fetcher
  LANDING: Fetcher
  COMMUNITY: Fetcher
  DASH: Fetcher
  APPLY: Fetcher
  INSPIRE_ME: Fetcher
}

// Deliberate allowlist: no API, GraphQL, SSR page, or backend readiness probes.
export const PROBES: readonly Probe[] = [
  {
    id: 'edge-router',
    label: 'Public Edge Router',
    group: 'Platform',
    binding: 'EDGE_ROUTER',
    url: 'https://groupher.com/health',
    service: 'edge-router',
  },
  {
    id: 'landing',
    label: 'Public Website',
    group: 'Applications',
    binding: 'LANDING',
    url: 'https://groupher.com/',
  },
  {
    id: 'community',
    label: 'Community',
    group: 'Applications',
    binding: 'COMMUNITY',
    url: 'https://community.groupher.com/health',
    service: 'community',
  },
  {
    id: 'dash',
    label: 'Dash',
    group: 'Applications',
    binding: 'DASH',
    url: 'https://dash.groupher.com/health',
    service: 'dash',
  },
  {
    id: 'apply',
    label: 'Apply',
    group: 'Applications',
    binding: 'APPLY',
    url: 'https://apply.groupher.com/health',
    service: 'apply',
  },
  {
    id: 'inspire-me',
    label: 'Inspire Me',
    group: 'Applications',
    binding: 'INSPIRE_ME',
    url: 'https://inspire-me.groupher.com/health',
    service: 'inspire-me',
  },
]

export type ProbeResult = { id: string; ok: boolean; responseMs: number | null }

async function readSmallJson(response: Response): Promise<Record<string, unknown> | null> {
  const reader = response.body?.getReader()
  if (!reader) return null
  const bytes = new Uint8Array(4_096)
  let length = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    if (length + chunk.value.length > bytes.length) {
      await reader.cancel()
      return null
    }
    bytes.set(chunk.value, length)
    length += chunk.value.length
  }
  return JSON.parse(new TextDecoder().decode(bytes.subarray(0, length))) as Record<string, unknown>
}

export async function checkProbe(
  probe: Probe,
  fetcher: typeof fetch = fetch,
): Promise<ProbeResult> {
  const started = Date.now()
  try {
    const response = await fetcher(probe.url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
      headers: { 'User-Agent': 'Groupher-Status/1.0' },
    })
    if (!response.ok) {
      await response.body?.cancel()
      return { id: probe.id, ok: false, responseMs: Date.now() - started }
    }
    if (!probe.service) {
      await response.body?.cancel()
      return { id: probe.id, ok: true, responseMs: Date.now() - started }
    }

    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > 4_096) {
      await response.body?.cancel()
      return { id: probe.id, ok: false, responseMs: Date.now() - started }
    }
    const body = await readSmallJson(response)
    return {
      id: probe.id,
      ok:
        body?.schemaVersion === 'health.v1' &&
        body.service === probe.service &&
        body.status === 'ok',
      responseMs: Date.now() - started,
    }
  } catch (error) {
    console.warn(
      JSON.stringify({ event: 'status_probe_failed', probe: probe.id, error: String(error) }),
    )
    return { id: probe.id, ok: false, responseMs: null }
  }
}

export async function checkAll(bindings: ProbeBindings): Promise<ProbeResult[]> {
  const results: ProbeResult[] = new Array(PROBES.length)
  let next = 0
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (next < PROBES.length) {
        const index = next++
        const probe = PROBES[index]
        results[index] = await checkProbe(probe, (input, init) =>
          bindings[probe.binding].fetch(input, init),
        )
      }
    }),
  )
  return results
}
