'use client'

import type { TListLayoutProps } from '../types'
import Item from './Item'
import useSalon from './salon'

export default function Masonry({
  assets,
  confirmingDeleteId,
  deletingAssetId,
  references,
  selectedAssetId,
  onCopy,
  onDelete,
  onOpen,
  onSelect,
}: TListLayoutProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {assets.map((asset) => (
        <Item
          key={asset.id}
          asset={asset}
          confirming={confirmingDeleteId === asset.id}
          deleting={deletingAssetId === asset.id}
          deleteDisabled={deletingAssetId !== null}
          references={references}
          selected={selectedAssetId === asset.id}
          onCopy={onCopy}
          onDelete={onDelete}
          onOpen={onOpen}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
