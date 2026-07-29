'use client'

import IconHub from '~/widgets/IconHub'

import { ASSETS_HUB_LABEL } from './constant'
import { assetLabel, formatAssetDimensions, formatAssetSize, isPreviewableImage } from './helper'
import ReferencesPanel from './ReferencesPanel'
import useSalon from './salon/preview_panel'
import type { TAsset, TReferencesState } from './spec'

type TProps = {
  asset: TAsset | null
  publicReadUrl: string
  references: TReferencesState
  onCopy: (asset: TAsset) => Promise<void>
  onOpen: (asset: TAsset) => void
}

export default function PreviewPanel({ asset, publicReadUrl, references, onCopy, onOpen }: TProps) {
  const s = useSalon()

  if (!asset) return null

  return (
    <div className={s.wrapper}>
      <div className={s.previewPanel}>
        <div className={s.previewFrame}>
          {isPreviewableImage(asset) && publicReadUrl ? (
            <img className={s.previewImage} src={publicReadUrl} alt={assetLabel(asset)} />
          ) : (
            <div className={s.previewFallback}>
              <IconHub provider='lucide' icon='image-off' size={5.5} />
              <span>{ASSETS_HUB_LABEL.PREVIEW_UNAVAILABLE}</span>
            </div>
          )}
        </div>

        <div className={s.previewInfo}>
          <div className={s.previewTitle}>{assetLabel(asset)}</div>
          <div className={s.previewMeta}>
            <span>{asset.mimeType || ASSETS_HUB_LABEL.UNKNOWN}</span>
            <span>{formatAssetSize(asset.sizeBytes)}</span>
            <span>{formatAssetDimensions(asset)}</span>
          </div>
          <div className={s.previewRef}>{asset.publicRef}</div>

          <div className={s.actions}>
            <button
              type='button'
              className={s.iconAction}
              disabled={!publicReadUrl}
              aria-label={ASSETS_HUB_LABEL.OPEN_URL}
              onClick={() => onOpen(asset)}
            >
              <IconHub provider='lucide' icon='external-link' size={3.25} />
            </button>
            <button
              type='button'
              className={s.iconAction}
              disabled={!publicReadUrl}
              aria-label={ASSETS_HUB_LABEL.COPY_URL}
              onClick={() => void onCopy(asset)}
            >
              <IconHub provider='lucide' icon='copy' size={3.25} />
            </button>
          </div>
        </div>
      </div>

      <ReferencesPanel asset={asset} references={references} />
    </div>
  )
}
