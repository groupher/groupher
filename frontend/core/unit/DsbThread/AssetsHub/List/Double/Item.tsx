'use client'

import DeleteAction from '../../DeleteAction'
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
      <AssetThumb asset={asset} variant='double' onSelect={onSelect} />

      <div className={s.main}>
        <button type='button' className={s.title} onClick={() => onSelect(asset.id)}>
          {assetLabel(asset)}
        </button>
        <div className={s.meta}>
          <span className={s.uploader}>{assetUploaderName(asset)}</span>
          <span className={s.deleteAction}>
            <DeleteAction
              confirming={confirming}
              deleting={deleting}
              disabled={deleteDisabled}
              referenced={referenced}
              onDelete={() => void onDelete(asset)}
            />
          </span>
        </div>
        <div className={s.actions}>
          <ItemActions asset={asset} onCopy={onCopy} onOpen={onOpen} />
        </div>
      </div>

      <div className={s.sideMeta}>
        <span className={s.size}>{formatAssetSize(asset.sizeBytes)}</span>
        <span className={s.uploadedAt}>{formatAssetDate(asset.insertedAt)}</span>
      </div>
    </div>
  )
}
