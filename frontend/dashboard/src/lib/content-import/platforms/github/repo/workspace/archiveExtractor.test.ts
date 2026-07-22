import { Readable } from 'node:stream'
import { createGzip } from 'node:zlib'

import tar from 'tar-stream'
import { describe, expect, it } from 'vitest'

import { extractArchiveToWorkspace } from './archiveExtractor'
import { withTemporaryWorkspace } from './temporaryWorkspace'

type TEntry = {
  body?: string
  linkname?: string
  name: string
  type?: tar.Headers['type']
}

const archive = async (entries: TEntry[]): Promise<ReadableStream<Uint8Array>> => {
  const pack = tar.pack()
  for (const entry of entries) {
    pack.entry(
      { linkname: entry.linkname, name: entry.name, type: entry.type ?? 'file' },
      entry.body ?? '',
    )
  }
  pack.finalize()
  const chunks: number[][] = []
  for await (const chunk of pack.pipe(createGzip())) chunks.push(Array.from(chunk as Uint8Array))
  return Readable.toWeb(
    Readable.from([Uint8Array.from(chunks.flat())]),
  ) as ReadableStream<Uint8Array>
}

describe('extractArchiveToWorkspace', () => {
  it('streams candidates into a read-only workspace and counts all expanded files', async () => {
    await withTemporaryWorkspace(async (directory) => {
      const result = await extractArchiveToWorkspace(
        await archive([
          { body: '# Start', name: 'docs-commit/docs/start.md' },
          { body: 'binary-ish', name: 'docs-commit/public/image.png' },
          { body: '{}', name: 'docs-commit/package.json' },
        ]),
        directory,
        'a'.repeat(40),
      )

      expect(result.stats).toMatchObject({ files: 3, retainedFiles: 2 })
      expect(result.workspace.files.map((file) => file.path)).toEqual([
        'docs/start.md',
        'package.json',
      ])
      await expect(result.workspace.readText('docs/start.md')).resolves.toBe('# Start')
    })
  })

  it('skips archive links without resolving or materializing their targets', async () => {
    await withTemporaryWorkspace(async (directory) => {
      const result = await extractArchiveToWorkspace(
        await archive([
          { body: '# Instructions', name: 'docs-commit/AGENTS.md' },
          {
            linkname: 'AGENTS.md',
            name: 'docs-commit/CLAUDE.md',
            type: 'symlink',
          },
          {
            linkname: 'AGENTS.md',
            name: 'docs-commit/INSTRUCTIONS.md',
            type: 'link',
          },
          { body: '# Start', name: 'docs-commit/docs/start.md' },
        ]),
        directory,
        'revision',
      )

      expect(result.stats).toMatchObject({ files: 4, retainedFiles: 2 })
      expect(result.workspace.files.map((file) => file.path)).toEqual([
        'AGENTS.md',
        'docs/start.md',
      ])
      await expect(result.workspace.readText('CLAUDE.md')).rejects.toThrow(
        'sourcePath: file not found: CLAUDE.md',
      )
    })
  })

  it('rejects an archive path that escapes the workspace', async () => {
    await withTemporaryWorkspace(async (directory) => {
      await expect(
        extractArchiveToWorkspace(
          await archive([{ name: 'docs-commit/../../escape.md' }]),
          directory,
          'revision',
        ),
      ).rejects.toMatchObject({ code: 'unsafe_archive_entry' })
    })
  })

  it.each(['block-device', 'character-device', 'fifo'] as const)(
    'rejects an unsupported archive entry: %s',
    async (type) => {
      await withTemporaryWorkspace(async (directory) => {
        await expect(
          extractArchiveToWorkspace(
            await archive([{ name: 'docs-commit/special', type }]),
            directory,
            'revision',
          ),
        ).rejects.toMatchObject({ code: 'unsafe_archive_entry' })
      })
    },
  )

  it('enforces actual expanded byte limits instead of trusting tar headers', async () => {
    await withTemporaryWorkspace(async (directory) => {
      await expect(
        extractArchiveToWorkspace(
          await archive([{ body: '12345', name: 'docs-commit/docs/start.md' }]),
          directory,
          'revision',
          { expandedBytes: 4, files: 10, retainedBytes: 10, singleFileBytes: 10 },
        ),
      ).rejects.toMatchObject({ code: 'archive_size_limit_exceeded' })
    })
  })

  it('enforces the total archive file limit', async () => {
    await withTemporaryWorkspace(async (directory) => {
      await expect(
        extractArchiveToWorkspace(
          await archive([
            { body: 'a', name: 'docs-commit/a.md' },
            { body: 'b', name: 'docs-commit/b.md' },
          ]),
          directory,
          'revision',
          { expandedBytes: 10, files: 1, retainedBytes: 10, singleFileBytes: 10 },
        ),
      ).rejects.toMatchObject({ code: 'archive_file_limit_exceeded' })
    })
  })
})
