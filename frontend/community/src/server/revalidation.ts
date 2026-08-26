const configuredPurge = (): { zoneId: string; token: string } | null => {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim()
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  return zoneId && token ? { zoneId, token } : null
}

const PURGE_TIMEOUT_MS = 5_000

/** Reports whether Cloudflare tag purging is configured for this runtime. */
export const hasConfiguredPurge = (): boolean => Boolean(configuredPurge())

/** Purges the supplied Community cache tags through the Cloudflare API. */
export const purgeCommunityTags = async (tags: string[]): Promise<void> => {
  const config = configuredPurge()
  if (!config) throw new Error('Community cache purge is not configured.')

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/purge_cache`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(PURGE_TIMEOUT_MS),
    },
  )
  if (!response.ok) throw new Error(`Cloudflare purge failed with ${response.status}.`)
}

/** Purges tags with structured completion logging for a Worker waitUntil task. */
export const observeCommunityTagPurge = async (tags: string[]): Promise<void> => {
  const startedAt = Date.now()
  try {
    await purgeCommunityTags(tags)
    console.info(
      JSON.stringify({
        event: 'community_cache_purge',
        status: 'ok',
        tags,
        durationMs: Date.now() - startedAt,
      }),
    )
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'community_cache_purge',
        status: 'error',
        tags,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
  }
}
