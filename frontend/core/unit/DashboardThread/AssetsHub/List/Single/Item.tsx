'use client'

import {
  assetLabel,
  assetUploaderName,
  formatAssetDate,
  formatAssetSize,
  isAssetReferenced,
} from '../../helper'
import AssetThumb from '../AssetThumb'
import ItemActions from '../ItemActions'
import type { TAssetItemProps } from '../types'
import useSalon from './salon/item'

export default function Item({
  asset,
  confirming,
  deleting,
  deleteDisabled,
  references,
  selected,
  onCopy,
  onDelete,
  onOpen,
  onSelect,
}: TAssetItemProps) {
  const s = useSalon({ selected })
  const referenced = isAssetReferenced(asset, references)

  return (
    <div className={s.wrapper}>
      <AssetThumb asset={asset} variant='single' onSelect={onSelect} />

      <div className={s.main}>
        <button type='button' className={s.title} onClick={() => onSelect(asset.id)}>
          {assetLabel(asset)}
        </button>
        <div className={s.meta}>{assetUploaderName(asset)}</div>
      </div>

      <div className={s.sideMeta}>
        <span className={s.uploadedAt}>{formatAssetDate(asset.insertedAt)}</span>
        <span className={s.size}>{formatAssetSize(asset.sizeBytes)}</span>
      </div>

      <div className={s.actions}>
        <ItemActions
          asset={asset}
          confirming={confirming}
          deleting={deleting}
          deleteDisabled={deleteDisabled}
          referenced={referenced}
          onCopy={onCopy}
          onDelete={onDelete}
          onOpen={onOpen}
        />
      </div>
    </div>
  )
}
