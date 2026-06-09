'use client'

import { useCallback } from 'react'

import { resolveWallpaperBgRenderSpec, useWallpaperBgRenderSpec } from '~/hooks/useWallpaper'
import { subscribeWallpaperPreview } from '~/lib/wallpaperPreview'
import BgRenderer from '~/widgets/BgRenderer'
import type { TBgPreviewSubscriber } from '~/widgets/BgRenderer/spec'

import type { TProps } from './spec'

export default function WallpaperRenderer({
  className,
  patternSize = 'auto',
  positioned = true,
  textureScale = 1,
}: TProps) {
  const renderSpec = useWallpaperBgRenderSpec()
  const previewSubscriber = useCallback<TBgPreviewSubscriber>(
    (listener) =>
      subscribeWallpaperPreview((state) => {
        listener(state ? resolveWallpaperBgRenderSpec(state) : null)
      }),
    [],
  )

  return (
    <BgRenderer
      className={className}
      renderSpec={renderSpec}
      patternSize={patternSize}
      positioned={positioned}
      previewSubscriber={previewSubscriber}
      textureScale={textureScale}
    />
  )
}
