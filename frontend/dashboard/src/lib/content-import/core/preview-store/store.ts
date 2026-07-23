/**
 * Runtime composition for PreviewStore.
 *
 *   local / CI -----> filesystem adapter --+
 *   Vercel --------> private Blob adapter --+--> FilesPreviewStore
 *
 * @see docs/bulk-import/import-file-sdk.md
 */
import path from 'node:path'

import { Files } from 'files-sdk'
import { fs } from 'files-sdk/fs'
import { vercelBlob } from 'files-sdk/vercel-blob'

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
  if (configured && configured !== 'local' && configured !== 'vercel-blob') {
    throw new Error('DOCS_IMPORT_PREVIEW_STORE must be either "local" or "vercel-blob".')
  }

  const inCI = environment.CI === 'true' || environment.CI === '1'
  const inProduction = environment.NODE_ENV === 'production'
  const backend =
    configured || (environment.VERCEL ? 'vercel-blob' : inCI || !inProduction ? 'local' : '')
  if (!backend) {
    throw new Error('DOCS_IMPORT_PREVIEW_STORE is required outside local, CI, or Vercel runtimes.')
  }

  const adapter =
    backend === 'vercel-blob'
      ? vercelBlob({
          access: 'private',
          allowOverwrite: false,
          oidcToken: environment.VERCEL_OIDC_TOKEN?.trim(),
          storeId: environment.BLOB_STORE_ID?.trim(),
          token: environment.BLOB_READ_WRITE_TOKEN?.trim(),
        })
      : fs({
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
