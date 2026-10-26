/**
 * Runtime composition for PreviewStore.
 *
 *   local / CI -> filesystem adapter -> FilesPreviewStore
 *   production -> explicit R2 composition in the Worker entrypoint
 *
 * @see docs/import/import-file-sdk.md
 */
import path from 'node:path'

import { Files } from 'files-sdk'
import { fs } from 'files-sdk/fs'

import FilesPreviewStore from './filesPreviewStore'
import type { PreviewStore } from './previewStore'

let store: PreviewStore | undefined

type TPreviewStoreEnvironment = Record<string, string | undefined>

/** Selects and configures the Files SDK backend for the current runtime. */
export const createImportFiles = (
  environment: TPreviewStoreEnvironment = process.env,
  workingDirectory = process.cwd(),
): Files => {
  const configured = environment.DOCS_IMPORT_PREVIEW_STORE?.trim().toLowerCase()
  if (configured && configured !== 'local') {
    throw new Error('DOCS_IMPORT_PREVIEW_STORE only supports "local" in the Node adapter.')
  }
  const inCI = environment.CI === 'true' || environment.CI === '1'
  if (environment.NODE_ENV === 'production' && !inCI && configured !== 'local') {
    throw new Error('DOCS_IMPORT_PREVIEW_STORE is required for the Node adapter; Workers use R2.')
  }
  const adapter = fs({
    root:
      environment.DOCS_IMPORT_PREVIEW_DIR?.trim() ||
      path.join(workingDirectory, '.tmp', 'content-import'),
  })

  return new Files({ adapter, prefix: 'content-import/previews' })
}

/** Builds an uncached PreviewStore, primarily for composition and tests. */
export const createPreviewStore = (
  environment: TPreviewStoreEnvironment = process.env,
  workingDirectory = process.cwd(),
): PreviewStore => new FilesPreviewStore(createImportFiles(environment, workingDirectory))

/** Returns the process-local PreviewStore client over durable shared storage. */
export const getPreviewStore = (): PreviewStore => {
  if (!store) store = createPreviewStore()
  return store
}

/** Clears only the cached test client; it does not delete persisted artifacts. */
export const resetPreviewStoreForTests = (): void => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('PreviewStore cache can only be reset in tests.')
  }
  store = undefined
}
