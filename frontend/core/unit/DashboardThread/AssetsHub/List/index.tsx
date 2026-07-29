'use client'

import { ASSETS_HUB_LABEL, ASSETS_HUB_LIST_VIEW } from '../constant'
import Double from './Double'
import Masonry from './Masonry'
import useSalon from './salon'
import Single from './Single'
import type { TListProps } from './types'

export default function List({
  assets,
  confirmingDeleteId,
  deletingAssetId,
  errorMessage,
  loading,
  references,
  selectedAssetId,
  viewMode,
  onCopy,
  onDelete,
  onOpen,
  onSelect,
}: TListProps) {
  const s = useSalon()

  if (errorMessage) return <div className={s.empty}>{errorMessage}</div>
  if (loading) return <div className={s.empty}>{ASSETS_HUB_LABEL.LOADING_ASSETS}</div>
  if (assets.length === 0) return <div className={s.empty}>{ASSETS_HUB_LABEL.EMPTY}</div>

  const layoutProps = {
    assets,
    confirmingDeleteId,
    deletingAssetId,
    references,
    selectedAssetId,
    onCopy,
    onDelete,
    onOpen,
    onSelect,
  }

  return (
    <div className={s.wrapper}>
      {viewMode === ASSETS_HUB_LIST_VIEW.DOUBLE ? (
        <Double {...layoutProps} />
      ) : viewMode === ASSETS_HUB_LIST_VIEW.MASONRY ? (
        <Masonry {...layoutProps} />
      ) : (
        <Single {...layoutProps} />
      )}
    </div>
  )
}
