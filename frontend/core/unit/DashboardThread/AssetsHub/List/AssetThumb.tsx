'use client'

import IconHub from '~/widgets/IconHub'

import { ASSETS_HUB_LABEL } from '../constant'
import { assetLabel, assetPublicReadUrl, isPreviewableImage } from '../helper'
import type { TAsset } from '../spec'
import useSalon from './salon/asset_thumb'

type TProps = {
  asset: TAsset
  variant: 'double' | 'masonry' | 'single'
  onSelect: (assetId: string) => void
}

export default function AssetThumb({ asset, variant, onSelect }: TProps) {
  const publicReadUrl = assetPublicReadUrl(asset)
  const previewable = isPreviewableImage(asset) && Boolean(publicReadUrl)
  const s = useSalon({ previewable, variant })

  return (
    <button
      type='button'
      className={s.wrapper}
      aria-label={ASSETS_HUB_LABEL.PREVIEW}
      onClick={() => onSelect(asset.id)}
    >
      {previewable && publicReadUrl ? (
        <img className={s.image} src={publicReadUrl} alt={assetLabel(asset)} loading='lazy' />
      ) : (
        <IconHub provider='lucide' icon='file' size={variant === 'masonry' ? 5 : 3.5} />
      )}
    </button>
  )
}
