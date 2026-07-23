/**
 * Temporary-directory lifetime boundary for source download and extraction.
 *
 *   mkdtemp -> operation -> finally recursive cleanup
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/** Runs one operation in a fresh directory and always removes it before returning. */
export const withTemporaryWorkspace = async <T>(
  run: (directory: string) => Promise<T>,
): Promise<T> => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'groupher-docs-import-'))
  await fs.chmod(directory, 0o700)
  try {
    return await run(directory)
  } finally {
    await fs.rm(directory, { force: true, recursive: true })
  }
}
