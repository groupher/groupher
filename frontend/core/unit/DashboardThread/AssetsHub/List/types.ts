import type { TAsset, TAssetListViewMode, TReferencesState } from '../spec'

export type TListProps = {
  assets: TAsset[]
  confirmingDeleteId: string | null
  deletingAssetId: string | null
  errorMessage: string | null
  loading: boolean
  references: TReferencesState
  selectedAssetId: string | null
  viewMode: TAssetListViewMode
  onCopy: (asset: TAsset) => Promise<void>
  onDelete: (asset: TAsset) => Promise<void>
  onOpen: (asset: TAsset) => void
  onSelect: (assetId: string) => void
}

export type TListLayoutProps = Omit<TListProps, 'errorMessage' | 'loading' | 'viewMode'>

export type TAssetItemProps = {
  asset: TAsset
  confirming: boolean
  deleting: boolean
  deleteDisabled: boolean
  references: TReferencesState
  selected: boolean
  onCopy: (asset: TAsset) => Promise<void>
  onDelete: (asset: TAsset) => Promise<void>
  onOpen: (asset: TAsset) => void
  onSelect: (assetId: string) => void
}
