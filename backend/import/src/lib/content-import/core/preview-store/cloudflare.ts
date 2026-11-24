/**
 * Constructs the R2-backed PreviewStore used by Cloudflare Workers.
 *
 * R2 binding -> Files SDK adapter -> PreviewStore contract
 */
import { Files } from 'files-sdk'
import { r2 } from 'files-sdk/r2'
import type { R2Bucket } from 'files-sdk/r2'

import FilesPreviewStore from './filesPreviewStore'

/** Creates the immutable PreviewStore over a Cloudflare R2 bucket binding. */
export const createR2PreviewStore = (bucket: R2Bucket) =>
  new FilesPreviewStore(
    new Files({
      adapter: r2({ binding: bucket }),
      prefix: 'content-import/previews',
    }),
  )
