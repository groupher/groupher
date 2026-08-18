/**
 * Files SDK implementation of the immutable PreviewStore contract.
 *
 *   typed value -> contract decoder -> immutable object key
 *                                      |
 *                         same bytes --+-- idempotent success
 *                     different bytes --+-- reject mutation
 *
 * In-process write chaining only serializes same-key races; durable
 * immutability is enforced again against the storage backend.
 *
 * @see docs/bulk-import/import-file-sdk.md
 */
import { Files, FilesError, type StoredFile } from 'files-sdk'

import {
  decodeDocsDataset,
  decodeSourceAnalysis,
  type TDocsDataset,
} from '../../threads/docs/contracts'
import { decodeDocImportPreview } from '../../threads/docs/contracts/preview'
import type {
  PreviewStore,
  TAnalysisRun,
  TApplyRun,
  TPreviewRecord,
  TPreviewSource,
  TReadyReceipt,
} from './previewStore'
import {
  assertAttemptRef,
  assertPreviewRef,
  decodeAnalysisRun,
  decodeApplyRun,
  decodePreviewRecord,
  decodeReadyReceipt,
  decodeSourceRef,
  encodeSourceRef,
} from './previewStore'

const jsonText = (value: unknown): string => JSON.stringify(value)
const RECORD_INDEX_PREFIX = '_preview-records/v1'
const RECORD_INDEX_READY_KEY = '_preview-records/v1-ready.json'
const RECORD_READ_CONCURRENCY = 8

const mapWithConcurrency = async <TInput, TOutput>(
  inputs: readonly TInput[],
  concurrency: number,
  mapper: (input: TInput) => Promise<TOutput>,
): Promise<TOutput[]> => {
  const results: TOutput[] = []
  let nextIndex = 0
  const workerCount = Math.min(Math.max(concurrency, 1), inputs.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = nextIndex
        nextIndex += 1
        if (index >= inputs.length) return
        results[index] = await mapper(inputs[index])
      }
    }),
  )

  return results
}

/** Persists Preview artifacts over local Files SDK or private Vercel Blob adapters. */
export default class FilesPreviewStore implements PreviewStore {
  private readonly writes = new Map<string, Promise<void>>()

  /** Creates a PreviewStore over the already-configured Files SDK provider. */
  constructor(private readonly files: Files) {}

  /** Creates the canonical record directly in the independently enumerable catalog. */
  async create(record: TPreviewRecord): Promise<void> {
    const safeRecord = decodePreviewRecord(record)
    await this.putImmutable(this.recordIndexKey(record.previewRef), safeRecord)
  }

  /** Deletes every artifact below the validated Preview prefix. */
  async delete(previewRef: string): Promise<void> {
    const keys: string[] = []
    for await (const file of this.files.listAll({ prefix: `${this.prefix(previewRef)}/` })) {
      keys.push(file.key)
    }
    if (keys.length > 0) await this.deleteKeys(keys)

    // Keep the record index until the Preview prefix has been removed. A
    // partial artifact deletion can then be retried by the next sweep.
    await this.deleteKeys([this.recordIndexKey(previewRef)])
  }

  /** Reads and decodes attempt-scoped SourceAnalysis. */
  async getAnalysis(previewRef: string, attemptRef: string) {
    const value = await this.getJson(
      this.attemptKey(previewRef, attemptRef, 'dataset/analysis.json'),
    )
    return value ? decodeSourceAnalysis(value) : null
  }

  /** Reads and decodes the analysis Workflow association. */
  async getAnalysisRun(previewRef: string): Promise<TAnalysisRun | null> {
    const value = await this.getJson(this.key(previewRef, 'analysis-run.json'))
    return value ? decodeAnalysisRun(value) : null
  }

  /** Reads and decodes the apply Workflow and Job association. */
  async getApplyRun(previewRef: string): Promise<TApplyRun | null> {
    const value = await this.getJson(this.key(previewRef, 'apply-run.json'))
    return value ? decodeApplyRun(value) : null
  }

  /** Reads and decodes the attempt-scoped Dataset manifest. */
  async getDataset(previewRef: string, attemptRef: string): Promise<TDocsDataset | null> {
    const value = await this.getJson(
      this.attemptKey(previewRef, attemptRef, 'dataset/manifest.json'),
    )
    return value ? decodeDocsDataset(value) : null
  }

  /** Reads and verifies the final ready receipt. */
  async getReady(previewRef: string, attemptRef: string): Promise<TReadyReceipt | null> {
    const value = await this.getJson(this.attemptKey(previewRef, attemptRef, 'ready.json'))
    return value ? decodeReadyReceipt(value) : null
  }

  /** Reads and decodes the Preview root record. */
  async getRecord(previewRef: string): Promise<TPreviewRecord | null> {
    const indexedValue = await this.getJson(this.recordIndexKey(previewRef))
    if (indexedValue) return decodePreviewRecord(indexedValue)

    // Compatibility for records created before the catalog became canonical.
    // A direct read also repairs a late legacy write even after backfill finished.
    const legacyValue = await this.getJson(this.key(previewRef, 'preview-record.json'))
    if (!legacyValue) return null

    const record = decodePreviewRecord(legacyValue)
    await this.putImmutable(this.recordIndexKey(previewRef), record)
    return record
  }

  /** Reads and decodes the Phoenix-validated Review artifact. */
  async getReview(previewRef: string, attemptRef: string) {
    const value = await this.getJson(
      this.attemptKey(previewRef, attemptRef, 'review/target-preview.json'),
    )
    return value ? decodeDocImportPreview(value) : null
  }

  /** Downloads one raw source body by encoded sourceRef. */
  async getSource(
    previewRef: string,
    attemptRef: string,
    sourceRef: string,
  ): Promise<TPreviewSource | null> {
    const key = this.attemptKey(
      previewRef,
      attemptRef,
      `dataset/bodies/${encodeSourceRef(sourceRef)}`,
    )
    try {
      return { markdown: await (await this.files.download(key)).text(), sourceRef }
    } catch (error) {
      if (error instanceof FilesError && error.code === 'NotFound') return null
      throw error
    }
  }

  /** Lists the independently indexed root records for bounded expiry cleanup. */
  async listRecords(): Promise<TPreviewRecord[]> {
    await this.ensureLegacyRecordIndex()

    const files: StoredFile[] = []
    for await (const file of this.files.listAll({ prefix: `${RECORD_INDEX_PREFIX}/` })) {
      files.push(file)
    }

    return mapWithConcurrency(files, RECORD_READ_CONCURRENCY, async (file) =>
      decodePreviewRecord(JSON.parse(await file.text()) as unknown),
    )
  }

  /** Lists sourceRefs from body object keys without downloading their contents. */
  async listSourceRefs(previewRef: string, attemptRef: string): Promise<string[]> {
    const prefix = `${this.attemptPrefix(previewRef, attemptRef)}/dataset/bodies/`
    const refs: string[] = []
    for await (const file of this.files.listAll({ prefix })) {
      refs.push(decodeSourceRef(file.key.slice(prefix.length)))
    }
    return refs.sort()
  }

  /** Writes the immutable final receipt after validating its attempt identity. */
  async markReady(previewRef: string, attemptRef: string, receipt: TReadyReceipt): Promise<void> {
    if (receipt.attemptRef !== attemptRef) throw new Error('Ready receipt attempt mismatch.')
    await this.putImmutable(
      this.attemptKey(previewRef, attemptRef, 'ready.json'),
      decodeReadyReceipt(receipt),
    )
  }

  /** Writes the immutable analysis Workflow association. */
  async putAnalysisRun(previewRef: string, run: TAnalysisRun): Promise<void> {
    if (run.previewRef !== previewRef) throw new Error('Analysis run preview mismatch.')
    await this.putImmutable(this.key(previewRef, 'analysis-run.json'), decodeAnalysisRun(run))
  }

  /** Writes the immutable apply Workflow and Job association. */
  async putApplyRun(previewRef: string, run: TApplyRun): Promise<void> {
    if (run.previewRef !== previewRef) throw new Error('Apply run preview mismatch.')
    await this.putImmutable(this.key(previewRef, 'apply-run.json'), decodeApplyRun(run))
  }

  /** Writes raw sources in bounded concurrency before analysis/tree diagnostics. */
  async putDataset(
    previewRef: string,
    attemptRef: string,
    analysis: ReturnType<typeof decodeSourceAnalysis>,
    sources: TPreviewSource[],
  ): Promise<void> {
    const safeAnalysis = decodeSourceAnalysis(analysis)
    const refs = new Set<string>()
    for (const source of sources) {
      if (refs.has(source.sourceRef)) throw new Error('Dataset contains a duplicate sourceRef.')
      refs.add(source.sourceRef)
    }
    for (let index = 0; index < sources.length; index += 16) {
      await Promise.all(
        sources
          .slice(index, index + 16)
          .map((source) =>
            this.putImmutableText(
              this.attemptKey(
                previewRef,
                attemptRef,
                `dataset/bodies/${encodeSourceRef(source.sourceRef)}`,
              ),
              source.markdown,
              'text/markdown; charset=utf-8',
            ),
          ),
      )
    }
    await this.putImmutable(
      this.attemptKey(previewRef, attemptRef, 'dataset/analysis.json'),
      safeAnalysis,
    )
    await this.putImmutable(
      this.attemptKey(previewRef, attemptRef, 'dataset/tree.json'),
      safeAnalysis.tree,
    )
    await this.putImmutable(
      this.attemptKey(previewRef, attemptRef, 'dataset/bad-smells.json'),
      safeAnalysis.badSmells,
    )
  }

  /** Writes the typed Dataset manifest referenced by the ready receipt. */
  async putManifest(previewRef: string, attemptRef: string, dataset: TDocsDataset): Promise<void> {
    await this.putImmutable(
      this.attemptKey(previewRef, attemptRef, 'dataset/manifest.json'),
      decodeDocsDataset(dataset),
    )
  }

  /** Writes the immutable target Review shown before confirmation. */
  async putReview(
    previewRef: string,
    attemptRef: string,
    preview: ReturnType<typeof decodeDocImportPreview>,
  ): Promise<void> {
    await this.putImmutable(
      this.attemptKey(previewRef, attemptRef, 'review/target-preview.json'),
      decodeDocImportPreview(preview),
    )
  }

  private attemptKey(previewRef: string, attemptRef: string, suffix: string): string {
    return `${this.attemptPrefix(previewRef, attemptRef)}/${suffix}`
  }

  private attemptPrefix(previewRef: string, attemptRef: string): string {
    assertAttemptRef(attemptRef)
    return `${this.prefix(previewRef)}/attempts/${attemptRef}`
  }

  private async getJson(key: string): Promise<unknown | null> {
    try {
      return JSON.parse(await (await this.files.download(key)).text()) as unknown
    } catch (error) {
      if (error instanceof FilesError && error.code === 'NotFound') return null
      throw error
    }
  }

  private key(previewRef: string, suffix: string): string {
    return `${this.prefix(previewRef)}/${suffix}`
  }

  private recordIndexKey(previewRef: string): string {
    assertPreviewRef(previewRef)
    return `${RECORD_INDEX_PREFIX}/${previewRef}.json`
  }

  private prefix(previewRef: string): string {
    assertPreviewRef(previewRef)
    return previewRef
  }

  private async deleteKeys(keys: string[]): Promise<void> {
    const result = await this.files.delete(keys)
    if (result.errors?.length) throw result.errors[0]!.error
  }

  /**
   * Backfills records written before the dedicated index existed. The marker is
   * written only after every legacy record has an immutable index copy, so a
   * failed migration is safe to retry. After this one-time pass, sweeps enumerate
   * O(record count) objects instead of every Dataset and source body.
   */
  private async ensureLegacyRecordIndex(): Promise<void> {
    if (await this.files.exists(RECORD_INDEX_READY_KEY)) return

    const legacyFiles: StoredFile[] = []
    for await (const file of this.files.listAll()) {
      if (file.key.endsWith('/preview-record.json')) legacyFiles.push(file)
    }

    const records = await mapWithConcurrency(legacyFiles, RECORD_READ_CONCURRENCY, async (file) =>
      decodePreviewRecord(JSON.parse(await file.text()) as unknown),
    )
    await mapWithConcurrency(records, RECORD_READ_CONCURRENCY, async (record) => {
      await this.putImmutable(this.recordIndexKey(record.previewRef), record)
    })
    await this.putImmutable(RECORD_INDEX_READY_KEY, { schemaVersion: 1 })
  }

  private async putImmutable(key: string, value: unknown): Promise<void> {
    await this.putImmutableText(key, jsonText(value), 'application/json')
  }

  private async putImmutableText(key: string, body: string, contentType: string): Promise<void> {
    const previous = this.writes.get(key) ?? Promise.resolve()
    const write = previous
      .catch(() => undefined)
      .then(() => this.writeImmutableText(key, body, contentType))
    this.writes.set(key, write)
    try {
      await write
    } finally {
      if (this.writes.get(key) === write) this.writes.delete(key)
    }
  }

  private async writeImmutableText(key: string, body: string, contentType: string): Promise<void> {
    if (await this.files.exists(key)) {
      const current = await (await this.files.download(key)).text()
      if (current !== body) throw new Error(`Immutable Preview object changed: ${key}`)
      return
    }
    try {
      await this.files.upload(key, body, { contentType })
    } catch (error) {
      if (!(error instanceof FilesError) || error.code !== 'Conflict') throw error
      const current = await (await this.files.download(key)).text()
      if (current !== body) throw new Error(`Immutable Preview object changed: ${key}`)
    }
  }
}
