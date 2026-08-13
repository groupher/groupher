import { ASSETS_HUB_READ_ENDPOINT } from '~/config'

import { ASSETS_HUB_EMPTY_VALUE, ASSETS_HUB_LABEL } from './constant'
import type { TAsset, TAssetRef, TAssetType, TReferencesState, TUploadProgress } from './spec'

/** Runs the checksum sha256 operation at the frontend shared boundary. */
export const checksumSha256 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const bytes = new Uint8Array(digest)
  let binary = ''

  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary)
}

/** Runs the asset type from mime operation at the frontend shared boundary. */
export const assetTypeFromMime = (mimeType: string): TAssetType =>
  mimeType.startsWith('image/') ? 'IMAGE' : 'FILE'

/** Runs the asset public read url operation at the frontend shared boundary. */
export const assetPublicReadUrl = (asset: TAsset): string =>
  asset.publicRef ? `${ASSETS_HUB_READ_ENDPOINT}/a/${asset.publicRef}/original` : ''

/** Runs the format asset size operation at the frontend shared boundary. */
export const formatAssetSize = (value?: number): string => {
  if (!value) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

/** Runs the format asset date operation at the frontend shared boundary. */
export const formatAssetDate = (value?: string): string => {
  if (!value) return ASSETS_HUB_EMPTY_VALUE

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

/** Runs the format upload duration operation at the frontend shared boundary. */
export const formatUploadDuration = (value?: number): string => {
  if (value == null) return ASSETS_HUB_EMPTY_VALUE
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(2)} s`
}

/** Reports whether previewable image at the frontend shared boundary. */
export const isPreviewableImage = (asset: TAsset): boolean =>
  asset.assetType === 'IMAGE' || asset.mimeType?.toLowerCase().startsWith('image/') === true

/** Runs the asset label operation at the frontend shared boundary. */
export const assetLabel = (asset: TAsset): string => asset.filename || asset.publicRef || asset.id

/** Runs the asset uploader name operation at the frontend shared boundary. */
export const assetUploaderName = (asset: TAsset): string =>
  asset.uploader?.nickname || asset.uploader?.login || ASSETS_HUB_LABEL.UNKNOWN

/** Reports whether asset referenced at the frontend shared boundary. */
export const isAssetReferenced = (asset: TAsset, references: TReferencesState): boolean =>
  references.assetId === asset.id && !references.loading && references.totalCount > 0

/** Runs the format asset dimensions operation at the frontend shared boundary. */
export const formatAssetDimensions = (asset: TAsset): string => {
  if (asset.width && asset.height) return `${asset.width} x ${asset.height}`
  return ASSETS_HUB_LABEL.NO_DIMENSIONS
}

/** Runs the format asset ref title operation at the frontend shared boundary. */
export const formatAssetRefTitle = (ref: TAssetRef): string => {
  if (ref.title) return ref.title
  if (ref.alt) return ref.alt
  if (ref.articleId) return `${ref.thread ?? ASSETS_HUB_LABEL.UNKNOWN} #${ref.articleId}`
  return ref.id
}

/** Runs the format asset ref meta operation at the frontend shared boundary. */
export const formatAssetRefMeta = (ref: TAssetRef): string =>
  [
    ref.usage,
    ref.blockType,
    ref.source,
    ref.blockId ? `block ${ref.blockId}` : null,
    ref.position != null ? `#${ref.position}` : null,
  ]
    .filter(Boolean)
    .join(' · ') || ASSETS_HUB_EMPTY_VALUE

/** Runs the extract error message operation at the frontend shared boundary. */
export const extractErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** Runs the put file with progress operation at the frontend shared boundary. */
export const putFileWithProgress = ({
  file,
  headers,
  method,
  onProgress,
  url,
}: {
  file: File
  headers: Record<string, string>
  method: 'PUT'
  onProgress: (progress: TUploadProgress) => void
  url: string
}): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return

      onProgress({
        loaded: event.loaded,
        percent: Math.round((event.loaded / event.total) * 100),
        total: event.total,
      })
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress({ loaded: file.size, percent: 100, total: file.size })
        resolve()
        return
      }

      reject(new Error(`R2 PUT failed: ${xhr.status}`))
    }

    xhr.onerror = () => reject(new Error('R2 PUT failed: network error'))
    xhr.onabort = () => reject(new Error('R2 PUT aborted'))
    xhr.open(method, url)

    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)

    xhr.send(file)
  })
