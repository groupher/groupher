/**
 * Resolves a public GitHub repository to one immutable archive revision.
 *
 *   repo URL -> repository metadata -> default branch -> commit SHA -> tarball response
 *
 * Redirect, timeout, compressed-size, and retry handling stay at this platform
 * boundary so SourceWorkspace never depends on GitHub HTTP details.
 *
 * @see docs/bulk-import/bulk-import.md
 * @see docs/bulk-import/content-import-architecture.md
 */
import { DocsImportError } from '../../../../core/errors'

export const MAX_COMPRESSED_ARCHIVE_BYTES = 50 * 1024 * 1024
export const ARCHIVE_DOWNLOAD_TIMEOUT_MS = 45_000
const GITHUB_OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/
const GITHUB_REPO = /^[A-Za-z0-9._-]{1,100}$/

export type TGitHubRepo = {
  archiveUrl: string
  branch: string
  commit: string
  owner: string
  repo: string
  repoUrl: string
}

type TDownloaderOptions = {
  fetchImpl?: typeof fetch
  retryAttempts?: number
  retryDelayMs?: number
  signal?: AbortSignal
  timeoutMs?: number
}

const delay = async (milliseconds: number, signal?: AbortSignal): Promise<void> => {
  if (milliseconds <= 0) return
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

const requestWithRetry = async (
  url: string,
  stage: 'downloading' | 'analyzing',
  options: TDownloaderOptions,
): Promise<Response> => {
  const retries = Math.min(Math.max(options.retryAttempts ?? 2, 0), 2)
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request(url, stage, options)
    } catch (error) {
      if (!(error instanceof DocsImportError) || !error.retryable || attempt >= retries) throw error
      await delay((options.retryDelayMs ?? 200) * 2 ** attempt, options.signal)
    }
  }
}

const githubHeaders = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'Groupher-Docs-Import',
  'X-GitHub-Api-Version': '2022-11-28',
}

/** Parses and canonicalizes the supported public GitHub repository URL shape. */
export const parseGitHubRepoUrl = (
  value: string,
): Pick<TGitHubRepo, 'owner' | 'repo' | 'repoUrl'> => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new DocsImportError(
      'invalid_github_repository_url',
      'admission',
      'Enter a valid public GitHub repository URL.',
    )
  }

  const segments = url.pathname.split('/').filter(Boolean)
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
    !segments[0] ||
    !repo ||
    !GITHUB_OWNER.test(segments[0]) ||
    !GITHUB_REPO.test(repo)
  ) {
    throw new DocsImportError(
      'invalid_github_repository_url',
      'admission',
      'Enter a standard https://github.com/owner/repository URL.',
    )
  }

  return {
    owner: segments[0],
    repo,
    repoUrl: `https://github.com/${segments[0]}/${repo}`,
  }
}

const responseError = (response: Response, stage: 'downloading' | 'analyzing'): DocsImportError => {
  if (response.status === 403 || response.status === 429) {
    return new DocsImportError(
      'github_archive_rate_limited',
      stage,
      'GitHub is temporarily limiting repository access. Try again later.',
      true,
      {
        retryAfter: response.headers.get('retry-after') || undefined,
        status: response.status,
      },
    )
  }
  if (response.status === 404) {
    return new DocsImportError(
      'github_repository_unavailable',
      stage,
      'The GitHub repository does not exist or is not publicly accessible.',
      false,
      { status: response.status },
    )
  }
  return new DocsImportError(
    stage === 'downloading' ? 'github_archive_download_failed' : 'github_repository_unavailable',
    stage,
    'GitHub could not provide the repository.',
    response.status >= 500,
    { status: response.status },
  )
}

const request = async (
  url: string,
  stage: 'downloading' | 'analyzing',
  options: TDownloaderOptions,
): Promise<Response> => {
  const timeoutController = new AbortController()
  const timeout = setTimeout(
    () => timeoutController.abort('GitHub request timed out'),
    options.timeoutMs ?? ARCHIVE_DOWNLOAD_TIMEOUT_MS,
  )
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal
  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      headers: githubHeaders,
      redirect: 'follow',
      signal,
    })
    if (!response.ok) throw responseError(response, stage)
    return response
  } catch (error) {
    if (error instanceof DocsImportError) throw error
    const failureCode =
      stage === 'downloading' ? 'github_archive_download_failed' : 'github_repository_unavailable'
    if (signal.aborted) {
      throw new DocsImportError(
        failureCode,
        stage,
        'The GitHub repository request timed out or was cancelled.',
        true,
      )
    }
    throw new DocsImportError(failureCode, stage, 'The GitHub repository request failed.', true)
  } finally {
    clearTimeout(timeout)
  }
}

const readArchiveChunk = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> => {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new DocsImportError(
                'github_archive_download_failed',
                'downloading',
                'The GitHub repository archive download stalled.',
                true,
              ),
            ),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

/** Resolves repository identity, default branch, and immutable commit metadata. */
export const resolveGitHubRepo = async (
  repoUrl: string,
  options: TDownloaderOptions = {},
): Promise<TGitHubRepo> => {
  const repo = parseGitHubRepoUrl(repoUrl)
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`
  const metadataResponse = await requestWithRetry(baseUrl, 'analyzing', options)
  const metadata = (await metadataResponse.json()) as { default_branch?: unknown }
  if (typeof metadata.default_branch !== 'string' || !metadata.default_branch) {
    throw new DocsImportError(
      'github_repository_unavailable',
      'analyzing',
      'GitHub did not return a default branch for this repository.',
    )
  }

  const commitResponse = await requestWithRetry(
    `${baseUrl}/commits/${encodeURIComponent(metadata.default_branch)}`,
    'analyzing',
    options,
  )
  const commit = (await commitResponse.json()) as { sha?: unknown }
  if (typeof commit.sha !== 'string' || !/^[a-f0-9]{40}$/i.test(commit.sha)) {
    throw new DocsImportError(
      'github_repository_unavailable',
      'analyzing',
      'GitHub did not return a fixed repository revision.',
    )
  }

  return {
    ...repo,
    archiveUrl: `https://codeload.github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/tar.gz/${commit.sha}`,
    branch: metadata.default_branch,
    commit: commit.sha,
  }
}

/** Opens the commit tarball as a bounded response without buffering the full archive. */
export const openGitHubArchive = async (
  repo: TGitHubRepo,
  options: TDownloaderOptions = {},
): Promise<ReadableStream<Uint8Array>> => {
  const response = await request(repo.archiveUrl, 'downloading', options)
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_COMPRESSED_ARCHIVE_BYTES) {
    await response.body?.cancel()
    throw new DocsImportError(
      'archive_size_limit_exceeded',
      'downloading',
      'The compressed repository archive exceeds the 50 MiB limit.',
    )
  }
  if (!response.body) {
    throw new DocsImportError(
      'github_archive_download_failed',
      'downloading',
      'GitHub returned an empty repository archive.',
      true,
    )
  }

  const reader = response.body.getReader()
  const readTimeoutMs = options.timeoutMs ?? ARCHIVE_DOWNLOAD_TIMEOUT_MS
  let received = 0
  return new ReadableStream<Uint8Array>({
    cancel: (reason) => reader.cancel(reason),
    pull: async (controller) => {
      try {
        const chunk = await readArchiveChunk(reader, readTimeoutMs)
        if (chunk.done) {
          controller.close()
          return
        }
        received += chunk.value.byteLength
        if (received > MAX_COMPRESSED_ARCHIVE_BYTES) {
          await reader.cancel('archive size limit exceeded')
          controller.error(
            new DocsImportError(
              'archive_size_limit_exceeded',
              'downloading',
              'The compressed repository archive exceeds the 50 MiB limit.',
            ),
          )
          return
        }
        controller.enqueue(chunk.value)
      } catch (error) {
        const failure =
          error instanceof DocsImportError
            ? error
            : new DocsImportError(
                'github_archive_download_failed',
                'downloading',
                'The GitHub repository archive download was interrupted.',
                true,
              )
        await reader.cancel(failure).catch(() => undefined)
        controller.error(failure)
      }
    },
  })
}
