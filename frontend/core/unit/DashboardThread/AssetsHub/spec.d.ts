import type { TSimpleUser } from '~/spec'

export type TAssetType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE'
export type TAssetStatus = 'ACTIVE' | 'DELETED'
export type TAssetListViewMode = 'single' | 'double' | 'masonry'

export type TAsset = {
  assetType?: TAssetType
  contentHash?: string
  deletedAt?: string
  filename?: string
  height?: number
  id: string
  insertedAt?: string
  mimeType?: string
  publicRef?: string
  sizeBytes?: number
  status?: TAssetStatus
  storage?: string
  storageKey?: string
  uploader?: TSimpleUser | null
  url?: string
  width?: number
}

export type TAssetRef = {
  alt?: string
  articleId?: string
  blockId?: string
  blockType?: string
  id: string
  insertedAt?: string
  position?: number
  source?: string
  thread?: string
  title?: string
  usage?: string
}

export type TPagedAssets = {
  entries: TAsset[]
  pageNumber?: number
  pageSize?: number
  totalCount: number
  totalPages?: number
}

export type TPagedAssetRefs = {
  entries: TAssetRef[]
  pageNumber?: number
  pageSize?: number
  totalCount: number
  totalPages?: number
}

export type TIntentResult = {
  createCommunityAssetUploadIntent: {
    assetPublicRef: string
    capability: string
    maxSizeBytes: number
    uploadRef: string
  }
}

export type THubUploadResult = {
  result: {
    upload: {
      headers: Record<string, string>
      method: 'PUT'
      url: string
    }
  }
}

export type TFinalizeResult = {
  result?: {
    timings?: Array<{
      duration: number
      label: string
    }>
  }
}

export type TDeleteResult = {
  deleteCommunityAsset: {
    deletedAt?: string
    id: string
    publicRef?: string
    status?: TAssetStatus
  }
}

export type TTiming = {
  duration?: number
  label: string
  state: 'done' | 'running'
}

export type TUploadProgress = {
  loaded: number
  percent: number
  total: number
}

export type TReferencesState = {
  assetId: string | null
  entries: TAssetRef[]
  error: string | null
  loading: boolean
  totalCount: number
}

export type TAssetsHubLogic = {
  assets: TAsset[]
  assetsErrorMessage: string | null
  busy: boolean
  community: string
  confirmingDeleteId: string | null
  deletingAssetId: string | null
  loadingAssets: boolean
  references: TReferencesState
  selectedAsset: TAsset | null
  selectedAssetUrl: string
  status: string
  timings: TTiming[]
  totalCount: number
  uploadProgress: TUploadProgress | null
  copyPublicReadUrl: (asset: TAsset) => Promise<void>
  deleteAsset: (asset: TAsset) => Promise<void>
  openPublicReadPreview: (asset: TAsset) => void
  selectAsset: (assetId: string) => void
  uploadFile: (file: File) => Promise<void>
}
