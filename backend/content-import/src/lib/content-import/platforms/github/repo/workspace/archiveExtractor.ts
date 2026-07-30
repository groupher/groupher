/**
 * Safely materializes candidate documentation files from a GitHub tar stream.
 *
 *   tar entries -> path validation -> candidate filter -> bounded disk writes
 *                                                    -> SourceWorkspace manifest
 *
 * @see docs/bulk-import/bulk-import.md
 * @see docs/bulk-import/content-import-architecture.md
 */
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { Readable, Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'

import tar from 'tar-stream'

import { DocsImportError } from '../../../../core/errors'
import type { TSourceWorkspace } from '../../../../threads/docs/contracts'
import { isCandidateSourceFile } from './candidateFilter'
import { createFilesystemSourceWorkspace, normalizeSourcePath } from './sourceWorkspace'

export const ARCHIVE_LIMITS = {
  expandedBytes: 500 * 1024 * 1024,
  files: 5_000,
  retainedBytes: 100 * 1024 * 1024,
  singleFileBytes: 10 * 1024 * 1024,
} as const

type TArchiveLimits = {
  expandedBytes: number
  files: number
  retainedBytes: number
  singleFileBytes: number
}

type TExtractionStats = {
  expandedBytes: number
  files: number
  retainedBytes: number
  retainedFiles: number
}

export type TExtractedWorkspace = {
  stats: TExtractionStats
  workspace: TSourceWorkspace
}

const extractionError = (code: string, message: string): DocsImportError =>
  new DocsImportError(code, 'extracting', message)

const isArchiveLink = (type: tar.Headers['type']): boolean => type === 'symlink' || type === 'link'

const archivePath = (value: string): string | null => {
  const portable = value.replace(/\\/g, '/')
  if (
    !portable ||
    portable.startsWith('/') ||
    /^[A-Za-z]:\//.test(portable) ||
    portable.includes('\0') ||
    portable.split('/').includes('..')
  ) {
    throw extractionError('unsafe_archive_entry', 'The repository archive contains an unsafe path.')
  }

  const segments = portable.split('/').filter(Boolean)
  if (segments.length <= 1) return null
  return normalizeSourcePath(segments.slice(1).join('/'))
}

const byteCounter = (onBytes: (size: number) => void): Transform =>
  new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try {
        onBytes(chunk.byteLength)
        callback(null, chunk)
      } catch (error) {
        callback(error as Error)
      }
    },
  })

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

const webArchive = async function* (
  archive: ReadableStream<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  const reader = archive.getReader()
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

/** Extracts one archive into a bounded temporary workspace and returns its manifest. */
export const extractArchiveToWorkspace = async (
  archive: ReadableStream<Uint8Array>,
  targetDirectory: string,
  revision: string,
  limits: TArchiveLimits = ARCHIVE_LIMITS,
): Promise<TExtractedWorkspace> => {
  const retainedFiles: Array<{ path: string; sizeBytes: number }> = []
  const stats: TExtractionStats = {
    expandedBytes: 0,
    files: 0,
    retainedBytes: 0,
    retainedFiles: 0,
  }
  const extract = tar.extract()
  const countFileEntry = (): void => {
    stats.files += 1
    if (stats.files > limits.files) {
      throw extractionError(
        'archive_file_limit_exceeded',
        `The repository archive exceeds the ${limits.files} file limit.`,
      )
    }
  }

  extract.on('entry', (header, entry, next) => {
    const processEntry = async (): Promise<void> => {
      if (header.type === 'pax-header' || header.type === 'pax-global-header') {
        entry.resume()
        return
      }
      // GitHub repositories may contain legitimate symlinks. The importer only
      // needs regular source files, so links are ignored without resolving or
      // materializing their targets inside the temporary workspace.
      if (isArchiveLink(header.type)) {
        countFileEntry()
        entry.resume()
        return
      }
      if (header.type !== 'file' && header.type !== 'directory') {
        throw extractionError(
          'unsafe_archive_entry',
          'The repository archive contains a device or unsupported entry.',
        )
      }

      const sourcePath = archivePath(header.name)
      if (header.type === 'directory' || !sourcePath) {
        entry.resume()
        return
      }

      countFileEntry()

      let fileBytes = 0
      const countBytes = (size: number): void => {
        fileBytes += size
        stats.expandedBytes += size
        if (fileBytes > limits.singleFileBytes) {
          throw extractionError(
            'archive_size_limit_exceeded',
            `A repository file exceeds the ${limits.singleFileBytes} byte limit.`,
          )
        }
        if (stats.expandedBytes > limits.expandedBytes) {
          throw extractionError(
            'archive_size_limit_exceeded',
            `The expanded repository exceeds the ${limits.expandedBytes} byte limit.`,
          )
        }
      }

      if (!isCandidateSourceFile(sourcePath)) {
        await pipeline(entry, byteSink(countBytes))
        return
      }

      const filename = path.join(/* turbopackIgnore: true */ targetDirectory, sourcePath)
      const resolvedFilename = path.resolve(/* turbopackIgnore: true */ filename)
      const resolvedRoot = path.resolve(/* turbopackIgnore: true */ targetDirectory)
      const relativeFilename = path.relative(resolvedRoot, resolvedFilename)
      if (
        relativeFilename === '..' ||
        relativeFilename.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeFilename)
      ) {
        throw extractionError('unsafe_archive_entry', 'An archive entry escapes the workspace.')
      }
      await fsPromises.mkdir(path.dirname(filename), { mode: 0o700, recursive: true })
      await pipeline(
        entry,
        byteCounter(countBytes),
        byteCounter((size) => {
          stats.retainedBytes += size
          if (stats.retainedBytes > limits.retainedBytes) {
            throw extractionError(
              'archive_size_limit_exceeded',
              `Retained source files exceed the ${limits.retainedBytes} byte limit.`,
            )
          }
        }),
        fs.createWriteStream(filename, { flags: 'wx', mode: 0o600 }),
      )
      retainedFiles.push({ path: sourcePath, sizeBytes: fileBytes })
      stats.retainedFiles += 1
    }

    void processEntry().then(next, (error) => extract.destroy(error as Error))
  })

  try {
    await pipeline(Readable.from(webArchive(archive)), createGunzip(), extract)
  } catch (error) {
    if (error instanceof DocsImportError) throw error
    throw extractionError('github_archive_download_failed', 'The repository archive is invalid.')
  }

  return {
    stats,
    workspace: createFilesystemSourceWorkspace(revision, targetDirectory, retainedFiles),
  }
}
