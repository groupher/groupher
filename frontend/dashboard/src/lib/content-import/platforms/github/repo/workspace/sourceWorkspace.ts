/** Framework-neutral read boundary over normalized candidate source files.
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  ContractError,
  type TSourceFile,
  type TSourceWorkspace,
} from '../../../../threads/docs/contracts'

const WINDOWS_SEPARATOR = /\\/g
const WINDOWS_DRIVE = /^[a-zA-Z]:\//

/** Normalizes a repository-relative POSIX path and rejects traversal or absolute paths. */
export const normalizeSourcePath = (value: string): string => {
  const normalized = path.posix.normalize(value.replace(WINDOWS_SEPARATOR, '/'))
  if (
    !value ||
    normalized === '.' ||
    normalized.startsWith('/') ||
    WINDOWS_DRIVE.test(normalized) ||
    normalized.includes('\0') ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw new ContractError('sourcePath', 'must be a relative path inside the workspace')
  }
  return normalized
}

/** Creates an in-memory SourceWorkspace for fixtures and small trusted inputs. */
export const createSourceWorkspace = (
  revision: string,
  files: ReadonlyMap<string, string>,
): TSourceWorkspace => {
  if (!revision) throw new ContractError('revision', 'expected a non-empty string')

  const contents = new Map<string, string>()
  const metadata: TSourceFile[] = []
  for (const [rawPath, body] of files) {
    const sourcePath = normalizeSourcePath(rawPath)
    if (contents.has(sourcePath)) {
      throw new ContractError('files', `duplicate normalized path ${sourcePath}`)
    }
    contents.set(sourcePath, body)
    metadata.push({ path: sourcePath, sizeBytes: Buffer.byteLength(body) })
  }
  metadata.sort((left, right) => left.path.localeCompare(right.path))

  return {
    files: metadata,
    revision,
    readText: async (rawPath: string) => {
      const sourcePath = normalizeSourcePath(rawPath)
      const body = contents.get(sourcePath)
      if (body === undefined) throw new ContractError('sourcePath', `file not found: ${sourcePath}`)
      return body
    },
  }
}

/** Creates a manifest-backed SourceWorkspace whose reads remain inside the extraction root. */
export const createFilesystemSourceWorkspace = (
  revision: string,
  root: string,
  files: readonly TSourceFile[],
): TSourceWorkspace => {
  if (!revision) throw new ContractError('revision', 'expected a non-empty string')
  const metadata = files
    .map((file) => ({ ...file, path: normalizeSourcePath(file.path) }))
    .sort((left, right) => left.path.localeCompare(right.path))
  const knownPaths = new Set(metadata.map((file) => file.path))

  return {
    files: metadata,
    revision,
    readText: async (rawPath: string) => {
      const sourcePath = normalizeSourcePath(rawPath)
      if (!knownPaths.has(sourcePath)) {
        throw new ContractError('sourcePath', `file not found: ${sourcePath}`)
      }
      return fs.readFile(path.join(root, sourcePath), 'utf8')
    },
  }
}
