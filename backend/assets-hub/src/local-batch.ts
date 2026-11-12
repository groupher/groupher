/**
 * Implements the filesystem-backed generated-image batch adapter for local Assets Hub development.
 *
 * Local provider
 *   -> persisted batch JSON
 *   -> GeneratedImageBatchState
 *   -> publish claim and reconciliation cleanup
 */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  TGeneratedImageManifestEntry,
  TGeneratedImageUploadBatch,
} from '@groupher/contracts/wallpaper'
import { createServiceAuthClientFromEnv, type TServiceAuthClient } from '@groupher/service/auth'

import { signPayload, type TGeneratedImageBatchCapability } from './capability'
import {
  GeneratedImageBatchState,
  generatedBatchCleanupDecision,
  manifestDigest,
  type TGeneratedImageBatchClaimResult,
} from './generated-batch'
import { LocalObjectStore } from './local-storage'

type TStoredBatch = {
  batch: TGeneratedImageUploadBatch
  entries: TGeneratedImageManifestEntry[]
  reconcileAttempts: number
}

type TLocalBatchEnvironment = Record<string, string | undefined>

const claimTtlMs = 15 * 60 * 1000
const wallpaperBatchPublishedQuery = `
  "Service-scoped check for a successfully published Wallpaper Batch"
  query WallpaperBatchPublished($batchRef: String!) {
    wallpaperBatchPublished(batchRef: $batchRef)
  }
`

const json = (value: unknown) => JSON.stringify(value)

/** Filesystem adapter for the same batch state machine used by the Worker DO. */
export class LocalGeneratedBatchStore {
  private readonly batchLocks = new Map<string, Promise<void>>()
  private serviceTokenProvider: TServiceAuthClient | undefined

  constructor(
    private readonly objectStore: LocalObjectStore,
    private readonly environment: TLocalBatchEnvironment,
  ) {}

  async create(capability: TGeneratedImageBatchCapability): Promise<TGeneratedImageUploadBatch> {
    return this.withBatchLock(capability.batchRef, async () => {
      const batch = this.batchFromCapability(capability)
      const existing = await this.read(capability.batchRef)
      if (existing) {
        if (json(existing.batch) !== json(batch))
          throw new Error('GENERATED_IMAGE_BATCH_REF_CONFLICT')
        return existing.batch
      }
      if (Date.parse(batch.expiresAt) <= Date.now())
        throw new Error('GENERATED_IMAGE_BATCH_EXPIRED')
      await this.write({ batch, entries: [], reconcileAttempts: 0 })
      return batch
    })
  }

  async registerAsset(batchRef: string, entry: TGeneratedImageManifestEntry) {
    return this.withBatchLock(batchRef, async () => {
      const stored = await this.required(batchRef)
      const state = this.state(stored)
      state.registerAsset(entry)
      const entries = [
        ...stored.entries.filter((item) => item.variantKey !== entry.variantKey),
        entry,
      ]
      await this.write({ ...stored, entries })
      return entry
    })
  }

  async claimForPublish(batchRef: string, key: string): Promise<TGeneratedImageBatchClaimResult> {
    return this.withBatchLock(batchRef, async () => {
      const stored = await this.required(batchRef)
      if (stored.batch.claim) {
        if (stored.batch.claim.type !== 'publish' || stored.batch.claim.key !== key) {
          throw new Error('GENERATED_IMAGE_BATCH_ALREADY_CLAIMED')
        }
        if (Date.parse(stored.batch.claim.expiresAt) <= Date.now()) {
          throw new Error('GENERATED_IMAGE_BATCH_CLAIM_EXPIRED')
        }
        return this.claimResult(stored)
      }

      const state = this.state(stored)
      let result: TGeneratedImageBatchClaimResult
      try {
        result = state.claimForPublish(key)
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'GENERATED_IMAGE_BATCH_INCOMPLETE_MANIFEST'
        ) {
          await this.deleteBatch(stored)
        }
        throw error
      }
      await this.write({ ...stored, batch: { ...stored.batch, claim: result.claim } })

      try {
        await Promise.all(
          result.manifest.map(async (entry) => {
            const object = await this.objectStore.headObject(entry.storageKey)
            if (!object)
              throw new Error(`GENERATED_IMAGE_BATCH_OBJECT_MISSING: ${entry.variantKey}`)
            if (object.ContentType !== entry.mimeType) {
              throw new Error(`GENERATED_IMAGE_BATCH_OBJECT_MIME_MISMATCH: ${entry.variantKey}`)
            }
            if (
              `sha256:${Buffer.from(object.ChecksumSHA256, 'base64').toString('hex')}` !==
              entry.checksum
            ) {
              throw new Error(`GENERATED_IMAGE_BATCH_OBJECT_CHECKSUM_MISMATCH: ${entry.variantKey}`)
            }
          }),
        )
        return result
      } catch (error) {
        await this.deleteBatch(stored)
        throw error
      }
    })
  }

  async cancel(batchRef: string): Promise<void> {
    return this.withBatchLock(batchRef, async () => {
      const stored = await this.required(batchRef)
      if (stored.batch.claim) throw new Error('GENERATED_IMAGE_BATCH_ALREADY_CLAIMED')
      const claim = this.state(stored).claimForDelete(`cancel:${batchRef}`).claim
      const claimed = { ...stored, batch: { ...stored.batch, claim } }
      await this.write(claimed)
      await this.deleteBatch(claimed)
    })
  }

  async cleanup(
    batchRef: string,
    claimKey: string,
  ): Promise<{ deleted: boolean; retained: boolean }> {
    return this.withBatchLock(batchRef, async () => {
      const stored = await this.required(batchRef)
      if (stored.batch.claim?.type !== 'publish' || stored.batch.claim.key !== claimKey) {
        throw new Error('GENERATED_IMAGE_BATCH_CLAIM_MISMATCH')
      }

      const published = await this.isWallpaperBatchPublished(batchRef)
      const decision = generatedBatchCleanupDecision(published)
      if (decision === 'retry') throw new Error('GENERATED_IMAGE_BATCH_PUBLISH_STATUS_UNKNOWN')

      if (decision === 'retain') {
        await this.removeBatchMetadata(batchRef)
        return { deleted: false, retained: true }
      }

      await this.deleteBatch(stored)
      return { deleted: true, retained: false }
    })
  }

  private batchFromCapability(
    capability: TGeneratedImageBatchCapability,
  ): TGeneratedImageUploadBatch {
    return {
      claim: null,
      expectedVariants: capability.expectedVariants,
      expiresAt: capability.expiresAt,
      publicRef: capability.batchRef,
      purpose: capability.purpose,
      requestDigest: capability.requestDigest,
      requestDigestVersion: capability.requestDigestVersion,
    }
  }

  async publishCapability(
    batchRef: string,
    result: TGeneratedImageBatchClaimResult,
  ): Promise<string> {
    const stored = await this.required(batchRef)
    const storedBatch = result.claim
    return signPayload(
      {
        batchRef,
        claimKey: storedBatch.key,
        expiresAt: storedBatch.expiresAt,
        manifest: result.manifest,
        manifestDigest: result.manifestDigest,
        policyVersion: this.environment.ASSETS_HUB_BATCH_POLICY_VERSION || 'v1',
        purpose: 'generated_image_publish',
        requestDigest: stored.batch.requestDigest,
        requestDigestVersion: stored.batch.requestDigestVersion,
        signingKeyId: this.environment.ASSETS_HUB_BATCH_SIGNING_KEY_ID || 'hmac-v1',
      },
      this.environment,
    )
  }

  private state(stored: TStoredBatch): GeneratedImageBatchState {
    const state = new GeneratedImageBatchState(stored.batch, claimTtlMs)
    for (const entry of stored.entries) state.registerAsset(entry)
    return state
  }

  private async required(batchRef: string): Promise<TStoredBatch> {
    const stored = await this.read(batchRef)
    if (!stored) throw new Error('GENERATED_IMAGE_BATCH_NOT_FOUND')
    return stored
  }

  private async read(batchRef: string): Promise<TStoredBatch | null> {
    try {
      const raw = await readFile(this.batchPath(batchRef), 'utf8')
      return JSON.parse(raw) as TStoredBatch
    } catch (error) {
      if (this.isMissing(error)) return null
      throw error
    }
  }

  private async write(stored: TStoredBatch): Promise<void> {
    await mkdir(path.dirname(this.batchPath(stored.batch.publicRef)), { recursive: true })
    const target = this.batchPath(stored.batch.publicRef)
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(stored), 'utf8')
    await rename(temporary, target)
  }

  private async deleteBatch(stored: TStoredBatch): Promise<void> {
    await this.objectStore.deleteObjects(stored.entries.map((entry) => entry.storageKey))
    await this.removeBatchMetadata(stored.batch.publicRef)
  }

  private async removeBatchMetadata(batchRef: string): Promise<void> {
    try {
      await rm(this.batchPath(batchRef), { force: true })
    } catch (error) {
      if (!this.isMissing(error)) throw error
    }
  }

  private async withBatchLock<T>(batchRef: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.batchLocks.get(batchRef) ?? Promise.resolve()
    const current = previous.catch(() => undefined).then(operation)
    const tail = current.then(
      () => undefined,
      () => undefined,
    )
    this.batchLocks.set(batchRef, tail)

    try {
      return await current
    } finally {
      if (this.batchLocks.get(batchRef) === tail) this.batchLocks.delete(batchRef)
    }
  }

  private claimResult(stored: TStoredBatch): TGeneratedImageBatchClaimResult {
    const manifest = stored.batch.expectedVariants.flatMap((target) => {
      const entry = stored.entries.find((item) => item.variantKey === target.variantKey)
      return entry ? [entry] : []
    })
    return {
      claim: stored.batch.claim!,
      manifest,
      manifestDigest: manifestDigest(manifest),
    }
  }

  private async isWallpaperBatchPublished(batchRef: string): Promise<boolean | null> {
    const endpoint = this.environment.PHOENIX_GRAPHQL_ENDPOINT?.trim()
    if (!endpoint) return null

    try {
      this.serviceTokenProvider ??= createServiceAuthClientFromEnv(this.environment)
      const token = await this.serviceTokenProvider.getToken({
        resource: 'https://api.groupher.com/assets',
        scopes: ['assets:generated-batch:reconcile'],
      })
      const response = await fetch(endpoint, {
        body: JSON.stringify({ query: wallpaperBatchPublishedQuery, variables: { batchRef } }),
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        method: 'POST',
      })
      if (!response.ok) return null
      const payload = (await response.json().catch(() => null)) as {
        data?: { wallpaperBatchPublished?: unknown }
        errors?: unknown[]
      } | null
      if (payload?.errors?.length || typeof payload?.data?.wallpaperBatchPublished !== 'boolean')
        return null
      return payload.data.wallpaperBatchPublished
    } catch {
      return null
    }
  }

  private batchPath(batchRef: string): string {
    const root = path.resolve(this.objectStore.root, 'batches')
    const safeRef = encodeURIComponent(batchRef)
    return path.join(root, `${safeRef}.json`)
  }

  private isMissing(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
  }
}
