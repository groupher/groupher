'use client'

import IconHub from '~/ui/IconHub'

import { ASSETS_HUB_LABEL } from '../constant'
import { assetPublicReadUrl } from '../helper'
import type { TAsset } from '../spec'
import useSalon from './salon/item_actions'

type TProps = {
  asset: TAsset
  onCopy: (asset: TAsset) => Promise<void>
  onOpen: (asset: TAsset) => void
}

export default function ItemActions({ asset, onCopy, onOpen }: TProps) {
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
    </div>
  )
}
