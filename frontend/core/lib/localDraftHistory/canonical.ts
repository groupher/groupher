/**
 * Produces deterministic local draft identities, hashes, and byte measurements.
 *
 *   adapter payload -> canonical JSON -> local hash / byte size -> repository record
 */

import type { TLocalDraftPayload, TLocalDraftWorkspaceIdentity } from './types'

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    )
  }
  return value
}

/** Serializes a local payload with stable object-key ordering for local-only deduplication. */
export const serializeLocalDraftPayload = (payload: TLocalDraftPayload): string =>
  JSON.stringify(canonicalize(payload))

/** Builds the account-isolated workspace key used by every LocalDraftHistory store. */
export const localDraftWorkspaceKey = (identity: TLocalDraftWorkspaceIdentity): string =>
  [
    identity.accountId,
    identity.communityId,
    identity.thread,
    identity.articleId,
    identity.branchId || '',
  ]
    .map(encodeURIComponent)
    .join(':')

/** Computes a deterministic non-cryptographic hash for local payload deduplication only. */
export const hashLocalDraftPayload = (payload: TLocalDraftPayload): string => {
  const source = serializeLocalDraftPayload(payload)
  let hash = 0x811c9dc5
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Measures the canonical UTF-8 record JSON while excluding the byteSize field itself. */
export const measureLocalDraftRecord = (record: Record<string, unknown>): number =>
  new TextEncoder().encode(JSON.stringify(canonicalize(record))).byteLength
