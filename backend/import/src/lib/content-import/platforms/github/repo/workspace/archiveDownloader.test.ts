import { describe, expect, it, vi } from 'vitest'

import {
  MAX_COMPRESSED_ARCHIVE_BYTES,
  openGitHubArchive,
  parseGitHubRepoUrl,
  resolveGitHubRepo,
} from './archiveDownloader'

describe('parseGitHubRepoUrl', () => {
  it('canonicalizes a standard public repository URL', () => {
    expect(parseGitHubRepoUrl('https://github.com/acme/docs.git')).toEqual({
      owner: 'acme',
      repo: 'docs',
      repoUrl: 'https://github.com/acme/docs',
    })
  })

  it.each([
    'http://github.com/acme/docs',
    'https://github.com/acme/docs/tree/main',
    'https://github.com/acme/docs?tab=readme',
    'https://gitlab.com/acme/docs',
    'https://github.com/acme%2Fother/docs',
  ])('rejects a non-standard repository URL: %s', (url) => {
    expect(() => parseGitHubRepoUrl(url)).toThrow('standard')
  })
})

describe('resolveGitHubRepo', () => {
  it('pins the default branch to a full commit archive', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ default_branch: 'main' }))
      .mockResolvedValueOnce(Response.json({ sha: 'a'.repeat(40) }))

    await expect(
      resolveGitHubRepo('https://github.com/acme/docs', {
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).resolves.toMatchObject({
      archiveUrl: `https://codeload.github.com/acme/docs/tar.gz/${'a'.repeat(40)}`,
      branch: 'main',
      commit: 'a'.repeat(40),
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('maps GitHub rate limits to a stable retryable error', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 429 }))

    await expect(
      resolveGitHubRepo('https://github.com/acme/docs', {
        fetchImpl: fetchImpl as typeof fetch,
        retryDelayMs: 0,
      }),
    ).rejects.toMatchObject({ code: 'github_archive_rate_limited', retryable: true })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('retries transient metadata and commit API failures independently', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(Response.json({ default_branch: 'main' }))
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(Response.json({ sha: 'a'.repeat(40) }))

    await expect(
      resolveGitHubRepo('https://github.com/acme/docs', {
        fetchImpl: fetchImpl as typeof fetch,
        retryDelayMs: 0,
      }),
    ).resolves.toMatchObject({ branch: 'main', commit: 'a'.repeat(40) })
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })
})

describe('openGitHubArchive', () => {
  const repo = {
    archiveUrl: 'https://codeload.github.com/acme/docs/tar.gz/commit',
    branch: 'main',
    commit: 'a'.repeat(40),
    owner: 'acme',
    repo: 'docs',
    repoUrl: 'https://github.com/acme/docs',
  }

  it('rejects an oversized Content-Length before consuming the stream', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('archive', {
          headers: { 'content-length': String(MAX_COMPRESSED_ARCHIVE_BYTES + 1) },
        }),
    )

    await expect(
      openGitHubArchive(repo, { fetchImpl: fetchImpl as typeof fetch }),
    ).rejects.toMatchObject({ code: 'archive_size_limit_exceeded' })
  })

  it('streams a bounded archive body', async () => {
    const fetchImpl = vi.fn(async () => new Response('archive'))
    const stream = await openGitHubArchive(repo, { fetchImpl: fetchImpl as typeof fetch })

    await expect(new Response(stream).text()).resolves.toBe('archive')
  })

  it('applies the timeout to each body read instead of the complete streamed download', async () => {
    const chunks = ['a', 'b', 'c']
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            async pull(controller) {
              await new Promise((resolve) => setTimeout(resolve, 10))
              const chunk = chunks.shift()
              if (chunk) controller.enqueue(new TextEncoder().encode(chunk))
              else controller.close()
            },
          }),
        ),
    )

    const stream = await openGitHubArchive(repo, {
      fetchImpl: fetchImpl as typeof fetch,
      timeoutMs: 20,
    })

    await expect(new Response(stream).text()).resolves.toBe('abc')
  })

  it('maps a stalled archive body to a retryable download error', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            pull: () => new Promise(() => undefined),
          }),
        ),
    )
    const stream = await openGitHubArchive(repo, {
      fetchImpl: fetchImpl as typeof fetch,
      timeoutMs: 10,
    })

    await expect(new Response(stream).arrayBuffer()).rejects.toMatchObject({
      code: 'github_archive_download_failed',
      retryable: true,
    })
  })
})
