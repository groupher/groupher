/**
 * Executes Community-owned Cloudflare cache-tag purges for public SSR responses.
 *
 * Cloudflare associates every `Cache-Tag` emitted by the SSR response with the
 * cached object. This module sends a tag purge to the zone API:
 *
 *   POST /client/v4/zones/{zoneId}/purge_cache
 *   Authorization: Bearer <token with Cache Purge permission>
 *   { "tags": ["community[home]-thread[POST]-article[42]"] }
 *
 * The purge deletes matching edge objects; it does not regenerate HTML or
 * advance `ArticleStats.snapshotAt`. The next public request becomes a cache
 * MISS (or can be EXPIRED with Tiered Cache), reaches Community SSR, and stores
 * a new HTML/hydration snapshot. A successful HTTP response means Cloudflare
 * accepted the request, not that a matching object necessarily existed.
 *
 * Current request flow:
 *
 *   successful GraphQL mutation
 *     -> server-owned mutation-to-tag mapping
 *     -> Worker waitUntil(observeCommunityTagPurge(tags))
 *     -> this module
 *     -> Cloudflare purge API
 *     -> next GET regenerates the public response
 *
 * `waitUntil` keeps this non-critical task alive after the mutation response,
 * but it is not durable delivery. The target transactional-outbox architecture
 * and cutover rules are documented in
 * `docs/architecture/public-cache-invalidation.md`.
 *
 * Official Cloudflare contracts:
 * - https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/
 * - https://developers.cloudflare.com/api/resources/cache/methods/purge/
 * - https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil
 */
const configuredPurge = (): { zoneId: string; token: string } | null => {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim()
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  return zoneId && token ? { zoneId, token } : null
}

const PURGE_TIMEOUT_MS = 5_000
const PURGE_MAX_ATTEMPTS = 2
const PURGE_RETRY_DELAY_MS = 100

const waitForPurgeRetry = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, PURGE_RETRY_DELAY_MS))

/** Reports whether Cloudflare tag purging is configured for this runtime. */
export const hasConfiguredPurge = (): boolean => Boolean(configuredPurge())

/**
 * Sends one Cloudflare tag-purge request.
 *
 * @example
 * `purgeCommunityTags(['community[home]-thread[POST]-articles'])` evicts every
 * cached list response carrying that tag. It does not evict unrelated article
 * details unless those responses also carry the same tag.
 *
 * @throws When credentials are absent, the request times out, or Cloudflare
 * rejects the purge. Retry and terminal logging belong to
 * `observeCommunityTagPurge` so direct callers can choose their own failure
 * semantics.
 */
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

/**
 * Retries and observes a non-blocking purge registered with Worker `waitUntil`.
 *
 * The function deliberately resolves after recording terminal failure because
 * the domain mutation has already committed and must not be reported as failed.
 * Structured logs expose retry count, duration, tags, and the final result.
 * Durable retry is owned by the target outbox architecture, not this helper.
 */
export const observeCommunityTagPurge = async (tags: string[]): Promise<void> => {
  const startedAt = Date.now()
  try {
    let attempt = 0
    while (attempt < PURGE_MAX_ATTEMPTS) {
      attempt += 1
      try {
        await purgeCommunityTags(tags)
        break
      } catch (error) {
        if (attempt >= PURGE_MAX_ATTEMPTS) throw error
        console.warn(
          JSON.stringify({
            event: 'community_cache_purge_retry',
            tags,
            attempt,
            error: error instanceof Error ? error.message : String(error),
          }),
        )
        await waitForPurgeRetry()
      }
    }
    console.info(
      JSON.stringify({
        event: 'community_cache_purge',
        status: 'ok',
        tags,
        durationMs: Date.now() - startedAt,
        attempts: attempt,
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
