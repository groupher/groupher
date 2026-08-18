/**
 * Implements the Src Dashboard App boundary inside Content Import.
 *
 * Business position:
 *
 *   Dashboard / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

import { createApp } from './app'
import {
  handleApplyDocImportPreview,
  handleCancelDocImportPreview,
  handleCreateDocImportPreview,
  handleGetDocImportPreview,
} from './lib/content-import/http'

export default createApp({
  handlers: {
    applyPreview: handleApplyDocImportPreview,
    cancelPreview: handleCancelDocImportPreview,
    createPreview: handleCreateDocImportPreview,
    getPreview: handleGetDocImportPreview,
  },
})
