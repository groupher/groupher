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
