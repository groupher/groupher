/**
 * Durable GitHub documentation analysis Workflow backed by R2 artifacts.
 *
 * GitHub revision -> parsed Dataset -> Preview artifacts in R2
 */
import { createHash } from 'node:crypto'
import { Readable, Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'

import type { R2Bucket } from '@cloudflare/workers-types'
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import { NonRetryableError } from 'cloudflare:workflows'
import tar from 'tar-stream'

import { createR2PreviewStore } from '../src/lib/content-import/core/preview-store/cloudflare'
import {
  READY_RECEIPT_SCHEMA_VERSION,
  sha256Json,
} from '../src/lib/content-import/core/preview-store/previewStore'
import { isCandidateSourceFile } from '../src/lib/content-import/platforms/github/repo/workspace/candidateFilter'
import {
  parseDocument,
  toDocumentTreeMetadata,
  type TDocumentTreeMetadata,
} from '../src/lib/content-import/threads/docs/analyzer/documentFile'
import type {
  TDocsDataset,
  TDocImportPreview,
  TDocImportSourceInfo,
  TSourceAnalysis,
  TSourceDocument,
} from '../src/lib/content-import/threads/docs/contracts'
import type {
  TSourceFile,
  TSourceWorkspace,
} from '../src/lib/content-import/threads/docs/contracts'
import {
  previewDocImportTarget,
  type TSourceInfo,
} from '../src/lib/content-import/transport/phoenix/docsImport'

type TWorkflowPayload = {
  attemptRef: string
  community: string
  previewRef: string
  repoUrl: string
}
type TArtifactRef = TSourceFile & { artifactRef: string }
type TWorkflowResult = {
  analysisRef: string
  artifactManifestRef: string
  documentCount: number
  expandedBytes: number
  framework: string
  retainedBytes: number
  revision: string
  repoUrl: string
  sourceCommit: string
  previewRef: string
}

type TExtractionStats = { expandedBytes: number; files: number; retainedBytes: number }

const ARCHIVE_LIMITS = {
  expandedBytes: 500 * 1024 * 1024,
  // The full 243-entry public docs repository has passed archive extraction.
  files: 243,
  documentBytes: 16 * 1024,
  pathBytes: 512,
  retainedBytes: 16 * 1024 * 1024,
  singleFileBytes: 10 * 1024 * 1024,
} as const

const MAX_COMPRESSED_ARCHIVE_BYTES = 50 * 1024 * 1024
const R2_MULTIPART_PART_BYTES = 5 * 1024 * 1024
const MAX_GITHUB_METADATA_BYTES = 1024 * 1024
const MAX_ANALYZER_SOURCE_FILE_BYTES = 16 * 1024
const MAX_GITHUB_REDIRECTS = 3
const GITHUB_HOSTS = new Set(['api.github.com', 'codeload.github.com'])

const isAnalyzerConfig = (path: string): boolean =>
  /(^|\/)\.vitepress\/config(?:\/|\.)/.test(path) ||
  /^(?:docusaurus\.config|sidebars)\.(?:[cm]?[jt]s)$/.test(path) ||
  /^(?:mkdocs\.ya?ml|rspress\.config\.(?:[cm]?[jt]s)|source\.config\.ts)$/.test(path) ||
  /(^|\/)astro\.config\.(?:[cm]?[jt]s)$/.test(path) ||
  /(^|\/)\_meta\.(?:js|ts|tsx)$/.test(path) ||
  path === 'app/_meta.global.tsx' ||
  /(^|\/)meta\.json$/.test(path)

const parsePublicGitHubRepo = (value: string) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new NonRetryableError('invalid_github_repository_url')
  }
  const segments = url.pathname.split('/').filter(Boolean)
  const owner = segments[0]
  const repo = segments[1]?.replace(/\.git$/, '')
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    segments.length !== 2 ||
    !owner ||
    !repo ||
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner) ||
    !/^[A-Za-z0-9._-]{1,100}$/.test(repo)
  ) {
    throw new NonRetryableError('invalid_github_repository_url')
  }
  return { owner, repo, repoUrl: `https://github.com/${owner}/${repo}` }
}

const fetchGitHubResponse = async (initialUrl: string, accept: string) => {
  let url = new URL(initialUrl)
  for (let redirects = 0; redirects <= MAX_GITHUB_REDIRECTS; redirects += 1) {
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      !GITHUB_HOSTS.has(url.hostname)
    ) {
      throw new NonRetryableError('github_redirect_host_rejected')
    }
    const response = await fetch(url, {
      headers: { accept, 'user-agent': 'Groupher-Docs-Import' },
      redirect: 'manual',
      signal: AbortSignal.timeout(45_000),
    })
    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    const location = response.headers.get('location')
    await response.body?.cancel()
    if (!location || redirects === MAX_GITHUB_REDIRECTS) {
      throw new NonRetryableError('github_redirect_limit_exceeded')
    }
    url = new URL(location, url)
  }
  throw new NonRetryableError('github_redirect_limit_exceeded')
}

const readBoundedJson = async (response: Response) => {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_GITHUB_METADATA_BYTES) {
    await response.body?.cancel()
    throw new NonRetryableError('github_metadata_too_large')
  }
  if (!response.ok) {
    await response.body?.cancel()
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`github_metadata_http_${response.status}`)
    }
    throw new NonRetryableError(`github_metadata_http_${response.status}`)
  }
  if (!response.body) throw new NonRetryableError('github_metadata_body_missing')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_GITHUB_METADATA_BYTES) throw new NonRetryableError('github_metadata_too_large')
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as { default_branch?: unknown; sha?: unknown }
}

const resolveAndStoreGitHubArchive = async (
  repoUrl: string,
  artifactRoot: string,
  bucket: R2Bucket,
) => {
  const repo = parsePublicGitHubRepo(repoUrl)
  const base = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`
  const metadataResponse = await fetchGitHubResponse(base, 'application/vnd.github+json')
  const metadata = await readBoundedJson(metadataResponse)
  if (typeof metadata.default_branch !== 'string' || !metadata.default_branch) {
    throw new NonRetryableError('github_default_branch_missing')
  }
  const commitResponse = await fetchGitHubResponse(
    `${base}/commits/${encodeURIComponent(metadata.default_branch)}`,
    'application/vnd.github+json',
  )
  const commitMetadata = await readBoundedJson(commitResponse)
  if (typeof commitMetadata.sha !== 'string' || !/^[a-f0-9]{40}$/i.test(commitMetadata.sha)) {
    throw new NonRetryableError('github_commit_sha_invalid')
  }
  const archive = await fetchGitHubResponse(
    `https://codeload.github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/tar.gz/${commitMetadata.sha}`,
    'application/vnd.github+json',
  )
  if (!archive.ok) {
    await archive.body?.cancel()
    if (archive.status === 429 || archive.status >= 500) {
      throw new Error(`github_archive_http_${archive.status}`)
    }
    throw new NonRetryableError(`github_archive_http_${archive.status}`)
  }
  if (!archive.body) throw new NonRetryableError('github_archive_body_missing')
  const rawContentLength = archive.headers.get('content-length')
  const contentLength = rawContentLength === null ? undefined : Number(rawContentLength)
  if (
    contentLength !== undefined &&
    (!Number.isSafeInteger(contentLength) ||
      contentLength < 0 ||
      contentLength > MAX_COMPRESSED_ARCHIVE_BYTES)
  ) {
    await archive.body.cancel()
    throw new NonRetryableError('archive_compressed_limit_exceeded')
  }
  const archiveRef = `${artifactRoot}/source.tar.gz`
  await putUnknownLengthArchive(archiveRef, archive.body, contentLength, bucket)
  return {
    archiveRef,
    branch: metadata.default_branch,
    repoUrl: repo.repoUrl,
    sourceCommit: commitMetadata.sha,
  }
}

const archivePath = (value: string): string | null => {
  const portable = value.replace(/\\/g, '/')
  if (
    !portable ||
    portable.startsWith('/') ||
    /^[A-Za-z]:\//.test(portable) ||
    portable.includes('\0') ||
    portable.split('/').includes('..')
  ) {
    throw new Error('unsafe_archive_entry')
  }
  const segments = portable.split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.')) throw new Error('unsafe_archive_entry')
  if (segments.length <= 1) return null
  const path = segments.slice(1).join('/')
  if (new TextEncoder().encode(path).byteLength > ARCHIVE_LIMITS.pathBytes) {
    throw new Error('archive_path_limit_exceeded')
  }
  return path
}

const webChunks = async function* (stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) return
      yield chunk.value
    }
  } finally {
    reader.releaseLock()
  }
}

const byteSink = (onBytes: (size: number) => void): Writable =>
  new Writable({
    write(chunk: Buffer, _encoding, callback) {
      try {
        onBytes(chunk.byteLength)
        callback()
      } catch (error) {
        callback(error as Error)
      }
    },
  })

const nodeReadableToWebStream = (readable: Readable): ReadableStream<Uint8Array> => {
  const iterator = readable[Symbol.asyncIterator]()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await iterator.next()
        if (chunk.done) controller.close()
        else controller.enqueue(new Uint8Array(chunk.value))
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel() {
      await iterator.return?.()
    },
  })
}

const extractArchiveToR2 = async (
  archive: ReadableStream<Uint8Array>,
  artifactRoot: string,
  env: Env,
): Promise<{ artifactRefs: TArtifactRef[]; stats: TExtractionStats }> => {
  const artifactRefs: TArtifactRef[] = []
  const paths = new Set<string>()
  const stats: TExtractionStats = { expandedBytes: 0, files: 0, retainedBytes: 0 }
  const extract = tar.extract()

  const countFile = () => {
    stats.files += 1
    if (stats.files > ARCHIVE_LIMITS.files) throw new Error('archive_file_limit_exceeded')
  }

  extract.on('entry', (rawHeader, entry, next) => {
    const header = rawHeader as { name: string; type: string; size: number }
    const processEntry = async () => {
      if (header.type === 'pax-header' || header.type === 'pax-global-header') {
        await pipeline(
          entry,
          byteSink(() => undefined),
        )
        return
      }
      if (header.type === 'symlink' || header.type === 'link') {
        countFile()
        await pipeline(
          entry,
          byteSink(() => undefined),
        )
        return
      }
      if (header.type !== 'file' && header.type !== 'directory') {
        throw new Error('unsafe_archive_entry')
      }

      const path = archivePath(header.name)
      if (header.type === 'directory' || !path) {
        await pipeline(
          entry,
          byteSink(() => undefined),
        )
        return
      }
      countFile()

      let fileBytes = 0
      const countBytes = (size: number) => {
        fileBytes += size
        stats.expandedBytes += size
        if (fileBytes > ARCHIVE_LIMITS.singleFileBytes) throw new Error('archive_single_file_limit')
        if (stats.expandedBytes > ARCHIVE_LIMITS.expandedBytes)
          throw new Error('archive_expanded_limit')
      }

      if (!isCandidateSourceFile(path)) {
        await pipeline(entry, byteSink(countBytes))
        return
      }
      if (paths.has(path)) throw new Error('duplicate_archive_path')
      paths.add(path)

      const counter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          try {
            countBytes(chunk.byteLength)
            stats.retainedBytes += chunk.byteLength
            if (stats.retainedBytes > ARCHIVE_LIMITS.retainedBytes) {
              throw new Error('archive_retained_limit')
            }
            callback(null, chunk)
          } catch (error) {
            callback(error as Error)
          }
        },
      })
      const key = `${artifactRoot}/source/${path}`
      const nodeStream = entry.pipe(counter) as Readable
      if (!Number.isSafeInteger(header.size) || header.size < 0) {
        throw new Error('invalid_archive_entry_size')
      }
      const fixedLength = new FixedLengthStream(header.size)
      const persist = env.ARTIFACTS.put(key, fixedLength.readable, {
        httpMetadata: {
          contentType: /\.mdx?$/i.test(path) ? 'text/markdown; charset=utf-8' : 'text/plain',
        },
      })
      const stream = nodeReadableToWebStream(nodeStream).pipeTo(fixedLength.writable)
      await Promise.all([persist, stream])
      artifactRefs.push({ artifactRef: key, path, sizeBytes: fileBytes })
    }

    void processEntry().then(
      () => next(),
      (error) => extract.destroy(error as Error),
    )
  })

  try {
    await pipeline(Readable.from(webChunks(archive)), createGunzip(), extract)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_repository_archive'
    if (
      message.startsWith('archive_') ||
      message === 'unsafe_archive_entry' ||
      message === 'duplicate_archive_path' ||
      message === 'invalid_archive_entry_size'
    ) {
      throw new NonRetryableError(message)
    }
    throw new Error(message)
  }

  return { artifactRefs, stats }
}

type Env = {
  ARTIFACTS: R2Bucket
}

const mergeChunks = (chunks: Uint8Array[], size: number): Uint8Array => {
  const merged = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

const putUnknownLengthArchive = async (
  key: string,
  body: ReadableStream<Uint8Array>,
  declaredBytes: number | undefined,
  bucket: R2Bucket,
): Promise<number> => {
  const upload = await bucket.createMultipartUpload(key, {
    httpMetadata: { contentType: 'application/gzip' },
  })
  const reader = body.getReader()
  const parts: R2UploadedPart[] = []
  let chunks: Uint8Array[] = []
  let pendingBytes = 0
  let totalBytes = 0

  const sendPart = async () => {
    const data = mergeChunks(chunks, pendingBytes)
    const part = await upload.uploadPart(parts.length + 1, data)
    parts.push(part)
    chunks = []
    pendingBytes = 0
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_COMPRESSED_ARCHIVE_BYTES) {
        throw new NonRetryableError('archive_compressed_limit_exceeded')
      }

      let offset = 0
      while (offset < value.byteLength) {
        const remaining = R2_MULTIPART_PART_BYTES - pendingBytes
        const take = Math.min(remaining, value.byteLength - offset)
        chunks.push(value.subarray(offset, offset + take))
        pendingBytes += take
        offset += take
        if (pendingBytes === R2_MULTIPART_PART_BYTES) await sendPart()
      }
    }

    if (totalBytes === 0) throw new NonRetryableError('archive_body_empty')
    if (declaredBytes !== undefined && declaredBytes !== totalBytes) {
      throw new NonRetryableError('archive_content_length_mismatch')
    }
    if (pendingBytes > 0) await sendPart()
    await upload.complete(parts)
    console.log('[content-import] multipart upload complete', {
      bytes: totalBytes,
      parts: parts.length,
    })
    return totalBytes
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    await upload.abort().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
}

export class ImportWorkflow extends WorkflowEntrypoint<Env, TWorkflowPayload> {
  async run(event: WorkflowEvent<TWorkflowPayload>, step: WorkflowStep): Promise<TWorkflowResult> {
    const { attemptRef, community, previewRef } = event.payload
    if (
      !attemptRef ||
      !community ||
      !previewRef ||
      !/^[a-zA-Z0-9_-]+$/.test(attemptRef) ||
      !/^[a-zA-Z0-9_-]+$/.test(previewRef)
    ) {
      throw new NonRetryableError('docs_import_workflow_payload_invalid')
    }
    const artifactRoot = `content-import/previews/${previewRef}/attempts/${attemptRef}/workflow/${event.instanceId}`
    const source = await step.do(
      'resolve and persist public GitHub archive',
      {
        retries: { limit: 1, delay: '1 second', backoff: 'constant' },
        timeout: '1 minute',
      },
      async () => {
        try {
          return await resolveAndStoreGitHubArchive(
            event.payload.repoUrl,
            artifactRoot,
            this.env.ARTIFACTS,
          )
        } catch (error) {
          console.warn('[content-import] GitHub source fetch failed', {
            message: error instanceof Error ? error.message : String(error),
          })
          throw error
        }
      },
    )
    const archiveRef = source.archiveRef

    const extraction = await step.do('stream archive files into R2', async () => {
      const archive = await this.env.ARTIFACTS.get(archiveRef)
      if (!archive) throw new Error(`Workflow archive was not found: ${archiveRef}`)
      const extracted = await extractArchiveToR2(archive.body, artifactRoot, this.env)
      const artifactManifestRef = `${artifactRoot}/source-manifest.json`
      await this.env.ARTIFACTS.put(artifactManifestRef, JSON.stringify(extracted.artifactRefs), {
        httpMetadata: { contentType: 'application/json' },
      })
      return { artifactManifestRef, stats: extracted.stats }
    })

    const artifactRefs = await step.do('load bounded source manifest', async () => {
      const manifest = await this.env.ARTIFACTS.get(extraction.artifactManifestRef)
      if (!manifest) {
        throw new Error(`Workflow source manifest was not found: ${extraction.artifactManifestRef}`)
      }
      const refs = await manifest.json<TArtifactRef[]>()
      if (!Array.isArray(refs) || refs.length > ARCHIVE_LIMITS.files) {
        throw new NonRetryableError('github_source_file_limit_exceeded')
      }
      return refs
    })
    const referencesByPath = new Map(artifactRefs.map((item) => [item.path, item]))
    const workspace: TSourceWorkspace = {
      files: artifactRefs
        .map(({ path, sizeBytes }) => ({ path, sizeBytes }))
        .sort((left, right) => left.path.localeCompare(right.path)),
      revision: event.instanceId,
      readText: async (path) => {
        const reference = referencesByPath.get(path)
        if (!reference) throw new Error(`Workflow source file was not found: ${path}`)
        const artifact = await this.env.ARTIFACTS.get(reference.artifactRef)
        if (!artifact) throw new Error(`Workflow artifact was not found: ${reference.artifactRef}`)
        return artifact.text()
      },
    }
    const { analyzeSourceTree } = await import('../src/lib/content-import/threads/docs/analyzer')
    if (
      workspace.files.some(
        (file) => isAnalyzerConfig(file.path) && file.sizeBytes > MAX_ANALYZER_SOURCE_FILE_BYTES,
      )
    ) {
      throw new NonRetryableError('source_analyzer_config_exceeds_free_cpu_budget')
    }
    const treePlan = await step.do('resolve Docs framework and content root', async () => {
      const plan = await analyzeSourceTree(workspace, new Map())
      return { source: plan.source }
    })
    const sourceFiles = workspace.files.filter(
      (file) => file.path.startsWith(`${treePlan.source.root}/`) && /\.mdx?$/i.test(file.path),
    )
    if (sourceFiles.length + 7 > 1_024) {
      throw new NonRetryableError('github_document_step_limit_exceeded')
    }

    const parsedDocuments: TSourceDocument[] = []
    const treeDocuments = new Map<string, TDocumentTreeMetadata>()
    const previewStore = createR2PreviewStore(this.env.ARTIFACTS)
    if (!source.repoUrl || !source.sourceCommit) {
      throw new NonRetryableError('docs_import_workflow_payload_invalid')
    }
    await step.do('validate import preview ownership', async () => {
      const record = await previewStore.getRecord(previewRef)
      if (!record || record.attemptRef !== attemptRef || record.community !== community) {
        throw new NonRetryableError('docs_import_preview_record_missing')
      }
    })
    for (const [index, file] of sourceFiles.entries()) {
      const parsed = await step.do(`parse source document ${index + 1}`, async () => {
        if (file.sizeBytes > ARCHIVE_LIMITS.documentBytes) {
          throw new NonRetryableError(`source_document_exceeds_free_cpu_budget:${file.path}`)
        }
        const markdown = await workspace.readText(file.path)
        const document = parseDocument(file.path, markdown, treePlan.source.root, file.sizeBytes)
        if (
          document.title.length > 512 ||
          (document.metadataTitle?.length ?? 0) > 512 ||
          (typeof document.frontmatter.sidebar_label === 'string' &&
            document.frontmatter.sidebar_label.length > 512)
        ) {
          throw new NonRetryableError(`source_document_title_too_long:${file.path}`)
        }
        await previewStore.putDatasetSource(previewRef, attemptRef, {
          markdown,
          sourceRef: document.sourcePath,
        })
        return {
          analysis: {
            contentHash: `source-md-v1:${createHash('sha256').update(markdown).digest('hex')}`,
            metadataTitle: document.metadataTitle,
            route: document.route,
            sizeBytes: document.sizeBytes,
            sourceRef: document.sourcePath,
            title: document.title,
            titleSource: document.titleSource,
          } satisfies TSourceDocument,
          tree: toDocumentTreeMetadata(document),
        }
      })
      parsedDocuments.push(parsed.analysis)
      treeDocuments.set(parsed.tree.sourcePath, parsed.tree)
    }

    const analysisSummary = await step.do('build Docs tree and persist Dataset', async () => {
      const tree = await analyzeSourceTree(workspace, treeDocuments)
      const analysis: TSourceAnalysis = {
        badSmells: [],
        documents: parsedDocuments,
        schemaVersion: 2,
        tree,
      }
      const analysisRef = `${artifactRoot}/source-analysis.json`
      await this.env.ARTIFACTS.put(analysisRef, JSON.stringify(analysis), {
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
      })

      const record = await previewStore.getRecord(previewRef)
      if (!record || record.attemptRef !== attemptRef || record.community !== community) {
        throw new NonRetryableError('docs_import_preview_record_missing')
      }

      const sourceInfo: TDocImportSourceInfo = {
        branch: source.branch || 'main',
        commit: source.sourceCommit,
        configPaths: analysis.tree.source.configPaths,
        contentRoot: analysis.tree.source.root,
        framework: analysis.tree.source.framework,
        repo: source.repoUrl.replace('https://github.com/', ''),
        repoUrl: source.repoUrl,
      }
      const datasetRef = `dset_${sha256Json({
        documents: analysis.documents,
        source: sourceInfo,
        tree: analysis.tree,
      }).slice(0, 40)}`
      const dataset: TDocsDataset = {
        analysisRef: 'dataset/analysis.json',
        badSmellsRef: 'dataset/bad-smells.json',
        bodiesRef: 'dataset/bodies/',
        capabilities: {
          actors: false,
          assets: false,
          comments: false,
          reactions: false,
          replies: false,
        },
        datasetRef,
        schemaVersion: 1,
        source: {
          type: 'repo',
          platform: 'github',
          revision: source.sourceCommit,
          scopeRef: sourceInfo.repo,
        },
        sourceInfo,
        thread: 'doc',
        treeRef: 'dataset/tree.json',
      }
      await previewStore.putDataset(previewRef, attemptRef, analysis, [])
      await previewStore.putManifest(previewRef, attemptRef, dataset)

      return {
        analysisRef,
        artifactManifestRef: extraction.artifactManifestRef,
        documentCount: analysis.documents.length,
        expandedBytes: extraction.stats.expandedBytes,
        framework: analysis.tree.source.framework,
        retainedBytes: extraction.stats.retainedBytes,
        revision: workspace.revision,
        repoUrl: source.repoUrl,
        sourceCommit: source.sourceCommit,
      }
    })

    await step.do('validate import target in Phoenix and mark Preview ready', async () => {
      const { attemptRef, community, previewRef } = event.payload
      if (!attemptRef || !community || !previewRef) {
        throw new NonRetryableError('docs_import_workflow_payload_invalid')
      }
      const store = createR2PreviewStore(this.env.ARTIFACTS)
      const [record, analysis, dataset] = await Promise.all([
        store.getRecord(previewRef),
        store.getAnalysis(previewRef, attemptRef),
        store.getDataset(previewRef, attemptRef),
      ])
      if (
        !record ||
        record.attemptRef !== attemptRef ||
        record.community !== community ||
        !analysis ||
        !dataset
      ) {
        throw new NonRetryableError('docs_import_dataset_missing')
      }
      const sourceInfo = dataset.sourceInfo as TSourceInfo
      const target = await previewDocImportTarget(community, sourceInfo, analysis, {
        serviceSubject: 'service:content-import',
      })
      const preview: TDocImportPreview = {
        badSmells: analysis.badSmells,
        conflicts: target.conflicts,
        counts: target.counts,
        expiresAt: record.expiresAt,
        previewRef,
        schemaVersion: 1,
        sourceInfo,
        targetRevision: target.targetRevision,
        targetTree: target.targetTree,
        tree: analysis.tree,
      }
      await store.putReview(previewRef, attemptRef, preview)
      await store.markReady(previewRef, attemptRef, {
        attemptRef,
        datasetManifestHash: sha256Json(dataset),
        datasetRef: dataset.datasetRef,
        schemaVersion: READY_RECEIPT_SCHEMA_VERSION,
        targetPreviewHash: sha256Json(preview),
        targetRevision: preview.targetRevision,
      })
    })
    return { ...analysisSummary, previewRef: event.payload.previewRef }
  }
}
