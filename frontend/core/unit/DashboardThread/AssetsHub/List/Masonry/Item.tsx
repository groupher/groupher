'use client'

import { ASSETS_HUB_LABEL } from '../../constant'
import { assetLabel, formatAssetDate, formatAssetSize, isAssetReferenced } from '../../helper'
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
      <AssetThumb asset={asset} variant='masonry' onSelect={onSelect} />

      <div className={s.content}>
        <button type='button' className={s.title} onClick={() => onSelect(asset.id)}>
          {assetLabel(asset)}
        </button>
        <div className={s.meta}>
          {asset.mimeType || ASSETS_HUB_LABEL.UNKNOWN} · {formatAssetSize(asset.sizeBytes)} ·{' '}
          {formatAssetDate(asset.insertedAt)}
        </div>
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
