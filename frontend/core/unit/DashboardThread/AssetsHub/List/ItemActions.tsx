'use client'

import IconHub from '~/widgets/IconHub'

import { ASSETS_HUB_LABEL } from '../constant'
import DeleteAction from '../DeleteAction'
import { assetPublicReadUrl } from '../helper'
import type { TAsset } from '../spec'
import useSalon from './salon/item_actions'

type TProps = {
  asset: TAsset
  confirming: boolean
  deleting: boolean
  deleteDisabled: boolean
  referenced: boolean
  onCopy: (asset: TAsset) => Promise<void>
  onDelete: (asset: TAsset) => Promise<void>
  onOpen: (asset: TAsset) => void
}

export default function ItemActions({
  asset,
  confirming,
  deleting,
  deleteDisabled,
  referenced,
  onCopy,
  onDelete,
  onOpen,
}: TProps) {
  const s = useSalon()
  const publicReadUrl = assetPublicReadUrl(asset)

  return (
    <div className={s.wrapper}>
      <button
        type='button'
        className={s.iconAction}
        onClick={() => onOpen(asset)}
        aria-label={ASSETS_HUB_LABEL.OPEN_URL}
        disabled={!publicReadUrl}
      >
        <IconHub provider='lucide' icon='external-link' size={3.25} />
      </button>
      <button
        type='button'
        className={s.iconAction}
        onClick={() => void onCopy(asset)}
        aria-label={ASSETS_HUB_LABEL.COPY_URL}
        disabled={!publicReadUrl}
      >
        <IconHub provider='lucide' icon='copy' size={3.25} />
      </button>
      <DeleteAction
        confirming={confirming}
        deleting={deleting}
        disabled={deleteDisabled}
        referenced={referenced}
        onDelete={() => void onDelete(asset)}
      />
    </div>
  )
}
