/**
 * Persists one temporary generated-image batch inside a SQLite-backed Durable Object.
 *
 * Assets Hub request
 *   -> GeneratedImageBatchDO
 *   -> SQLite manifest and claim
 *   -> R2 cleanup or Phoenix reconciliation
 */
import type {
  TGeneratedImageBatchClaim,
  TGeneratedImageManifestEntry,
  TGeneratedImageUploadBatch,
} from '@groupher/contracts/wallpaper'
import { createServiceAuthClientFromEnv, type TServiceAuthClient } from '@groupher/service/auth'
import { DurableObject } from 'cloudflare:workers'

import {
  GeneratedImageBatchState,
  generatedBatchCleanupDecision,
  generatedBatchReconciliationBackoffMs,
  manifestDigest,
  type TGeneratedImageBatchClaimResult,
} from './generated-batch'

type TStoredBatch = TGeneratedImageUploadBatch & {
  entries: TGeneratedImageManifestEntry[]
  reconcileAttempts: number
}

const claimTtlMs = 15 * 60 * 1000
const safetyMarginMs = 60 * 1000
const reconciliationRetryMs = 5 * 60 * 1000
const reconciliationBackoffAttempts = 6
const publishTransactionBudgetMs = 10 * 1000
const maxClockSkewMs = 5 * 1000

const assertBatchPolicy = (env: Env): void => {
  if ((env.ASSETS_HUB_BATCH_POLICY_VERSION || 'v1') !== 'v1') {
    throw new Error('GENERATED_IMAGE_BATCH_POLICY_VERSION_UNSUPPORTED')
  }
  if ((env.ASSETS_HUB_BATCH_SIGNING_KEY_ID || 'hmac-v1') !== 'hmac-v1') {
    throw new Error('GENERATED_IMAGE_BATCH_SIGNING_KEY_UNSUPPORTED')
  }
  if (
    safetyMarginMs >= claimTtlMs ||
    reconciliationRetryMs >= claimTtlMs ||
    publishTransactionBudgetMs + maxClockSkewMs >= claimTtlMs
  ) {
    throw new Error('GENERATED_IMAGE_BATCH_LEASE_POLICY_INVALID')
  }
}

const wallpaperBatchPublishedQuery = `
  "Service-scoped check for a successfully published Wallpaper Batch"
  query WallpaperBatchPublished($batchRef: String!) {
    wallpaperBatchPublished(batchRef: $batchRef)
  }
`

const json = (value: unknown) => JSON.stringify(value)

const hex = (value: ArrayBuffer): string =>
  [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

/** Durable per-Batch store that serializes manifest registration and claims. */
export class GeneratedImageBatchDO extends DurableObject<Env> {
  private serviceTokenProvider: TServiceAuthClient | undefined

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    assertBatchPolicy(env)
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS generated_batches (
          public_ref TEXT PRIMARY KEY,
          purpose TEXT NOT NULL,
          request_digest TEXT NOT NULL,
          request_digest_version INTEGER NOT NULL,
          expected_variants_json TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          claim_type TEXT,
          claim_key TEXT,
          claimed_at TEXT,
          claim_expires_at TEXT,
          reconcile_attempts INTEGER NOT NULL DEFAULT 0
        )
      `)
      const columns = this.ctx.storage.sql
        .exec<{ name: string }>('PRAGMA table_info(generated_batches)')
        .toArray()
      if (!columns.some((column) => column.name === 'reconcile_attempts')) {
        this.ctx.storage.sql.exec(
          'ALTER TABLE generated_batches ADD COLUMN reconcile_attempts INTEGER NOT NULL DEFAULT 0',
        )
      }
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS generated_batch_entries (
          batch_ref TEXT NOT NULL,
          variant_key TEXT NOT NULL,
          entry_json TEXT NOT NULL,
          PRIMARY KEY (batch_ref, variant_key)
        )
      `)
      this.ctx.storage.sql.exec(
        'CREATE INDEX IF NOT EXISTS generated_batch_entries_batch_ref ON generated_batch_entries(batch_ref)',
      )
    })
  }

  async create(batch: TGeneratedImageUploadBatch): Promise<TGeneratedImageUploadBatch> {
    const existing = this.readBatch()
    if (existing) {
      if (json(this.batchShape(existing)) !== json(this.batchShape(batch))) {
        throw new Error('GENERATED_IMAGE_BATCH_REF_CONFLICT')
      }
      await this.ctx.storage.setAlarm(this.nextAlarmAt(existing))
      return this.batchShape(existing)
    }

    if (Date.parse(batch.expiresAt) <= Date.now()) {
      throw new Error('GENERATED_IMAGE_BATCH_EXPIRED')
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO generated_batches
        (public_ref, purpose, request_digest, request_digest_version, expected_variants_json, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      batch.publicRef,
      batch.purpose,
      batch.requestDigest,
      batch.requestDigestVersion,
      json(batch.expectedVariants),
      batch.expiresAt,
    )
    await this.ctx.storage.setAlarm(Date.parse(batch.expiresAt))
    return batch
  }

  snapshot(): TGeneratedImageUploadBatch | null {
    const batch = this.readBatch()
    if (!batch) return null
    return {
      claim: batch.claim,
      expectedVariants: batch.expectedVariants,
      expiresAt: batch.expiresAt,
      publicRef: batch.publicRef,
      purpose: batch.purpose,
      requestDigest: batch.requestDigest,
      requestDigestVersion: batch.requestDigestVersion,
    }
  }

  registerAsset(entry: TGeneratedImageManifestEntry): TGeneratedImageManifestEntry {
    const batch = this.readBatch()
    if (!batch) throw new Error('GENERATED_IMAGE_BATCH_NOT_FOUND')
    if (batch.claim) throw new Error('GENERATED_IMAGE_BATCH_MANIFEST_FROZEN')

    const state = this.state(batch)
    state.registerAsset(entry)
    this.ctx.storage.sql.exec(
      `INSERT INTO generated_batch_entries (batch_ref, variant_key, entry_json)
       VALUES (?, ?, ?)
       ON CONFLICT(batch_ref, variant_key) DO UPDATE SET entry_json = excluded.entry_json`,
      batch.publicRef,
      entry.variantKey,
      json(entry),
    )
    return entry
  }

  async claimForPublish(key: string, now = Date.now()): Promise<TGeneratedImageBatchClaimResult> {
    const batch = this.readBatch()
    if (!batch) throw new Error('GENERATED_IMAGE_BATCH_NOT_FOUND')

    if (batch.claim) {
      if (batch.claim.type === 'publish' && batch.claim.key === key) {
        if (Date.parse(batch.claim.expiresAt) <= now) {
          throw new Error('GENERATED_IMAGE_BATCH_CLAIM_EXPIRED')
        }
        return this.claimResult(batch.claim, batch.entries)
      }
      throw new Error('GENERATED_IMAGE_BATCH_ALREADY_CLAIMED')
    }

    if (Date.parse(batch.expiresAt) <= now) {
      throw new Error('GENERATED_IMAGE_BATCH_EXPIRED')
    }

    if (batch.entries.length !== batch.expectedVariants.length) {
      const deleteResult = this.state(batch).claimForDelete(`invalid-manifest:${key}`, now)
      this.persistClaim(batch.publicRef, deleteResult.claim)
      await this.deleteClaimed(deleteResult.claim.key, now)
      throw new Error('GENERATED_IMAGE_BATCH_INCOMPLETE_MANIFEST')
    }

    const result = this.state(batch).claimForPublish(key, now)
    this.persistClaim(batch.publicRef, result.claim)
    try {
      await this.validateStoredObjects(result.manifest)
      return result
    } catch (error) {
      this.transitionClaimToDelete(batch.publicRef, result.claim.key, now)
      await this.deleteClaimed(result.claim.key, now, true)
      throw error
    }
  }

  async tryClaimForPublish(
    key: string,
    now = Date.now(),
  ): Promise<{ ok: true; value: TGeneratedImageBatchClaimResult } | { ok: false; error: string }> {
    try {
      return { ok: true, value: await this.claimForPublish(key, now) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  claimForDelete(key: string, now = Date.now()): TGeneratedImageBatchClaimResult {
    const batch = this.readBatch()
    if (!batch) throw new Error('GENERATED_IMAGE_BATCH_NOT_FOUND')

    if (batch.claim) {
      if (batch.claim.type === 'delete' && batch.claim.key === key) {
        if (Date.parse(batch.claim.expiresAt) <= now) {
          throw new Error('GENERATED_IMAGE_BATCH_CLAIM_EXPIRED')
        }
        return this.claimResult(batch.claim, batch.entries)
      }
      throw new Error('GENERATED_IMAGE_BATCH_ALREADY_CLAIMED')
    }

    const result = this.state(batch).claimForDelete(key, now)
    this.persistClaim(batch.publicRef, result.claim)
    return result
  }

  async deleteClaimed(key: string, now = Date.now(), allowExpired = false): Promise<void> {
    const batch = this.readBatch()
    if (!batch?.claim || batch.claim.key !== key) {
      throw new Error('GENERATED_IMAGE_BATCH_DELETE_CLAIM_REQUIRED')
    }
    if (!allowExpired && Date.parse(batch.claim.expiresAt) <= now) {
      throw new Error('GENERATED_IMAGE_BATCH_DELETE_CLAIM_EXPIRED')
    }

    const entries = batch.entries
    if (entries.length)
      await this.env.ASSETS_BUCKET.delete(entries.map((entry) => entry.storageKey))
    this.ctx.storage.sql.exec(
      'DELETE FROM generated_batch_entries WHERE batch_ref = ?',
      batch.publicRef,
    )
    this.ctx.storage.sql.exec('DELETE FROM generated_batches WHERE public_ref = ?', batch.publicRef)
    await this.ctx.storage.deleteAlarm()
  }

  /**
   * Re-check publication inside the serialized batch object before deleting a
   * publish claim. A Phoenix-side check can become stale while the request is
   * in flight; the Hub-side probe is the final safety gate before R2 deletion.
   */
  async cleanupPublishClaim(
    key: string,
    now = Date.now(),
  ): Promise<{ deleted: boolean; published: boolean }> {
    const batch = this.readBatch()
    if (!batch?.claim || batch.claim.type !== 'publish' || batch.claim.key !== key) {
      throw new Error('GENERATED_IMAGE_BATCH_DELETE_CLAIM_REQUIRED')
    }

    const published = await this.isWallpaperBatchPublished(batch.publicRef)
    const cleanupDecision = generatedBatchCleanupDecision(published)
    if (cleanupDecision === 'retry') {
      throw new Error('GENERATED_IMAGE_BATCH_PUBLISH_STATUS_UNKNOWN')
    }

    if (cleanupDecision === 'retain') {
      await this.deleteMetadataOnly(batch.publicRef)
      return { deleted: false, published: true }
    }

    await this.deleteClaimed(key, now, true)
    return { deleted: true, published: false }
  }

  async tryCleanupPublishClaim(
    key: string,
    now = Date.now(),
  ): Promise<
    { ok: true; value: { deleted: boolean; published: boolean } } | { ok: false; error: string }
  > {
    try {
      return { ok: true, value: await this.cleanupPublishClaim(key, now) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async alarm(): Promise<void> {
    const batch = this.readBatch()
    if (!batch) return

    const now = Date.now()
    if (batch.claim?.type === 'publish') {
      await this.reconcilePublishClaim(batch, now)
      return
    }

    if (batch.claim?.type === 'delete') {
      await this.deleteClaimed(batch.claim.key, now, true)
      return
    }

    if (Date.parse(batch.expiresAt) > now) {
      await this.ctx.storage.setAlarm(Date.parse(batch.expiresAt))
      return
    }

    const deleteKey = `${batch.publicRef}:expiry`
    this.state(batch).claimForDelete(deleteKey, now)
    this.persistClaim(batch.publicRef, {
      claimedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + claimTtlMs).toISOString(),
      key: deleteKey,
      type: 'delete',
    })
    await this.deleteClaimed(deleteKey, now)
  }

  private async reconcilePublishClaim(batch: TStoredBatch, now: number): Promise<void> {
    const claimExpiry = batch.claim ? Date.parse(batch.claim.expiresAt) : 0
    if (now < claimExpiry + safetyMarginMs) {
      await this.ctx.storage.setAlarm(claimExpiry + safetyMarginMs)
      return
    }

    const published = await this.isWallpaperBatchPublished(batch.publicRef)
    if (published === null) {
      const attempts = batch.reconcileAttempts + 1
      this.ctx.storage.sql.exec(
        'UPDATE generated_batches SET reconcile_attempts = ? WHERE public_ref = ?',
        attempts,
        batch.publicRef,
      )
      const backoff = generatedBatchReconciliationBackoffMs(attempts)
      if (attempts === reconciliationBackoffAttempts + 1) {
        console.error(
          `Generated image batch reconciliation is still unavailable: ${batch.publicRef}`,
        )
      }
      await this.ctx.storage.setAlarm(now + backoff)
      return
    }

    if (published) {
      await this.deleteMetadataOnly(batch.publicRef)
      return
    }

    await this.deleteClaimed(batch.claim!.key, now, true)
  }

  private async isWallpaperBatchPublished(batchRef: string): Promise<boolean | null> {
    const endpoint = this.env.PHOENIX_GRAPHQL_ENDPOINT?.trim()
    if (!endpoint) return null

    try {
      this.serviceTokenProvider ??= createServiceAuthClientFromEnv({
        SERVICE_AUTH_CLIENT_ID: this.env.SERVICE_AUTH_CLIENT_ID,
        SERVICE_AUTH_CLIENT_SECRET: this.env.SERVICE_AUTH_CLIENT_SECRET,
        SERVICE_AUTH_TOKEN_ENDPOINT: this.env.SERVICE_AUTH_TOKEN_ENDPOINT,
      })
      const serviceToken = await this.serviceTokenProvider.getToken({
        resource: 'https://api.groupher.com/assets',
        scopes: ['assets:generated-batch:reconcile'],
      })
      const response = await fetch(endpoint, {
        body: JSON.stringify({ query: wallpaperBatchPublishedQuery, variables: { batchRef } }),
        headers: {
          authorization: `Bearer ${serviceToken}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      })
      if (!response.ok) return null
      const payload = (await response.json().catch(() => null)) as {
        data?: { wallpaperBatchPublished?: unknown }
        errors?: unknown[]
      } | null
      if (payload?.errors?.length || typeof payload?.data?.wallpaperBatchPublished !== 'boolean') {
        return null
      }
      return payload.data.wallpaperBatchPublished
    } catch {
      return null
    }
  }

  private async deleteMetadataOnly(batchRef: string): Promise<void> {
    this.ctx.storage.sql.exec('DELETE FROM generated_batch_entries WHERE batch_ref = ?', batchRef)
    this.ctx.storage.sql.exec('DELETE FROM generated_batches WHERE public_ref = ?', batchRef)
    await this.ctx.storage.deleteAlarm()
  }

  private async validateStoredObjects(entries: TGeneratedImageManifestEntry[]): Promise<void> {
    await Promise.all(
      entries.map(async (entry) => {
        const object = await this.env.ASSETS_BUCKET.head(entry.storageKey)
        if (!object) throw new Error(`GENERATED_IMAGE_BATCH_OBJECT_MISSING: ${entry.variantKey}`)
        if (object.httpMetadata?.contentType !== entry.mimeType) {
          throw new Error(`GENERATED_IMAGE_BATCH_OBJECT_MIME_MISMATCH: ${entry.variantKey}`)
        }
        let checksum = object.checksums.sha256 ? `sha256:${hex(object.checksums.sha256)}` : null

        // Presigned S3 uploads do not always persist checksum metadata in R2.
        // Finalize still records the content hash, so verify the object body when
        // HEAD cannot provide a checksum instead of rejecting a valid upload.
        if (!checksum) {
          const storedObject = await this.env.ASSETS_BUCKET.get(entry.storageKey)
          if (!storedObject) {
            throw new Error(`GENERATED_IMAGE_BATCH_OBJECT_MISSING: ${entry.variantKey}`)
          }
          const bytes = await new Response(storedObject.body).arrayBuffer()
          checksum = `sha256:${hex(await crypto.subtle.digest('SHA-256', bytes))}`
        }

        if (checksum !== entry.checksum) {
          throw new Error(`GENERATED_IMAGE_BATCH_OBJECT_CHECKSUM_MISMATCH: ${entry.variantKey}`)
        }
      }),
    )
  }

  private state(batch: TStoredBatch): GeneratedImageBatchState {
    const state = new GeneratedImageBatchState(
      {
        claim: null,
        expectedVariants: batch.expectedVariants,
        expiresAt: batch.expiresAt,
        publicRef: batch.publicRef,
        purpose: batch.purpose,
        requestDigest: batch.requestDigest,
        requestDigestVersion: batch.requestDigestVersion,
      },
      claimTtlMs,
    )
    for (const entry of batch.entries) state.registerAsset(entry)
    return state
  }

  private batchShape(batch: TGeneratedImageUploadBatch | TStoredBatch): TGeneratedImageUploadBatch {
    return {
      claim: batch.claim,
      expectedVariants: batch.expectedVariants,
      expiresAt: batch.expiresAt,
      publicRef: batch.publicRef,
      purpose: batch.purpose,
      requestDigest: batch.requestDigest,
      requestDigestVersion: batch.requestDigestVersion,
    }
  }

  private claimResult(
    claim: TGeneratedImageBatchClaim,
    entries: TGeneratedImageManifestEntry[],
  ): TGeneratedImageBatchClaimResult {
    return { claim, manifest: entries, manifestDigest: manifestDigest(entries) }
  }

  private persistClaim(publicRef: string, claim: TGeneratedImageBatchClaim): void {
    this.ctx.storage.sql.exec(
      `UPDATE generated_batches
       SET claim_type = ?, claim_key = ?, claimed_at = ?, claim_expires_at = ?, reconcile_attempts = 0
       WHERE public_ref = ? AND claim_type IS NULL`,
      claim.type,
      claim.key,
      claim.claimedAt,
      claim.expiresAt,
      publicRef,
    )

    const row = this.ctx.storage.sql
      .exec<{ claim_type: string | null; claim_key: string | null }>(
        'SELECT claim_type, claim_key FROM generated_batches WHERE public_ref = ?',
        publicRef,
      )
      .toArray()[0]
    if (row?.claim_type !== claim.type || row.claim_key !== claim.key) {
      throw new Error('GENERATED_IMAGE_BATCH_CLAIM_PERSIST_FAILED')
    }
  }

  private nextAlarmAt(batch: TStoredBatch): number {
    if (batch.claim) return Date.parse(batch.claim.expiresAt)
    return Date.parse(batch.expiresAt)
  }

  private transitionClaimToDelete(publicRef: string, key: string, now: number): void {
    this.ctx.storage.sql.exec(
      `UPDATE generated_batches
       SET claim_type = 'delete', claimed_at = ?, claim_expires_at = ?
       WHERE public_ref = ? AND claim_key = ?`,
      new Date(now).toISOString(),
      new Date(now + claimTtlMs).toISOString(),
      publicRef,
      key,
    )
  }

  private readBatch(): TStoredBatch | null {
    const row = this.ctx.storage.sql
      .exec<{
        claim_expires_at: string | null
        reconcile_attempts: number
        claim_key: string | null
        claim_type: 'publish' | 'delete' | null
        claimed_at: string | null
        expected_variants_json: string
        expires_at: string
        public_ref: string
        purpose: string
        request_digest: string
        request_digest_version: number
      }>('SELECT * FROM generated_batches LIMIT 1')
      .toArray()[0]
    if (!row) return null

    const claim =
      row.claim_type && row.claim_key && row.claimed_at && row.claim_expires_at
        ? {
            expiresAt: row.claim_expires_at,
            key: row.claim_key,
            type: row.claim_type,
            claimedAt: row.claimed_at,
          }
        : null
    const entries = this.ctx.storage.sql
      .exec<{ entry_json: string }>(
        'SELECT entry_json FROM generated_batch_entries WHERE batch_ref = ? ORDER BY variant_key',
        row.public_ref,
      )
      .toArray()
      .map((entry) => JSON.parse(entry.entry_json) as TGeneratedImageManifestEntry)

    return {
      claim,
      entries,
      reconcileAttempts: row.reconcile_attempts || 0,
      expectedVariants: JSON.parse(row.expected_variants_json),
      expiresAt: row.expires_at,
      publicRef: row.public_ref,
      purpose: row.purpose,
      requestDigest: row.request_digest,
      requestDigestVersion: row.request_digest_version,
    }
  }
}
