import { THREAD } from '~/const/thread'

export const ASSETS_HUB_PAGE_SIZE = 12
export const ASSETS_HUB_REFS_PAGE_SIZE = 5
export const ASSETS_HUB_ACCEPT_MIME = 'image/png,image/jpeg,image/webp,image/gif'
export const ASSETS_HUB_DEBUG_UPLOAD_THREAD = THREAD.POST

export const ASSETS_HUB_THREAD_FILTER = {
  ALL: 'ALL',
  CHANGELOG: THREAD.CHANGELOG,
  DOC: THREAD.DOC,
  POST: THREAD.POST,
} as const

export const ASSETS_HUB_LIST_VIEW = {
  DOUBLE: 'double',
  MASONRY: 'masonry',
  SINGLE: 'single',
} as const

export const ASSETS_HUB_LIST_VIEW_OPTIONS = [
  {
    label: 'Single row',
    mode: ASSETS_HUB_LIST_VIEW.SINGLE,
  },
  {
    label: 'Two columns',
    mode: ASSETS_HUB_LIST_VIEW.DOUBLE,
  },
  {
    label: 'Masonry',
    mode: ASSETS_HUB_LIST_VIEW.MASONRY,
  },
] as const

export const ASSETS_HUB_UPLOAD_STATUS = {
  CHECKSUM: 'checksum',
  DONE: 'done',
  FAILED: 'failed',
  FINALIZE: 'finalize',
  IDLE: 'idle',
  INTENT: 'intent',
  PRESIGN: 'presign',
  PUT: 'put',
} as const

export const ASSETS_HUB_LABEL = {
  ASSET_COUNT: 'assets',
  COPY_URL: 'Copy URL',
  DELETE: 'Delete',
  DELETE_BLOCKED: 'Referenced',
  DELETE_CONFIRMING: 'Confirm delete',
  DELETE_DELETING: 'Deleting',
  EMPTY: 'No assets yet',
  FILE_INPUT: 'Upload asset',
  FILTER: 'Filter assets',
  LOADING_ASSETS: 'Loading assets',
  NO_DIMENSIONS: 'no dimensions',
  OPEN_URL: 'Open original',
  PREVIEW: 'Preview',
  PREVIEW_UNAVAILABLE: 'No image preview',
  REFERENCES_EMPTY: 'No active references',
  REFERENCES_ERROR: 'Unable to load references',
  REFERENCES_LOADING: 'Checking references',
  REFERENCES_TITLE: 'References',
  SEARCH: 'Search assets',
  SEARCH_SHORT: 'Search',
  TITLE: 'Assets Hub',
  UNKNOWN: 'unknown',
  UPLOAD: 'Upload',
  UPLOAD_STATUS: 'upload',
} as const

export const ASSETS_HUB_MESSAGE = {
  ASSET_DELETED: 'Asset deleted',
  DELETE_CONFIRM: 'Click delete again to confirm',
  MISSING_PUBLIC_REF: 'Asset public ref is missing',
  REFERENCED_DELETE_BLOCKED: 'Asset is still referenced',
  UNABLE_TO_COPY_URL: 'Unable to copy asset URL',
  URL_COPIED: 'Asset URL copied',
  UPLOAD_COMPLETED: 'Assets Hub upload completed',
} as const

export const ASSETS_HUB_EMPTY_VALUE = '-'
