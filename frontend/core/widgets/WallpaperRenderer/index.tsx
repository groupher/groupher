'use client'

import { useCallback } from 'react'

import {
  resolveWallpaperCoreBgRenderSpec,
  useWallpaperCoreBgRenderSpec,
} from '~/hooks/useWallpaper'
import { subscribeWallpaperPreview } from '~/lib/wallpaperPreview'
import CoreBgRenderer from '~/widgets/CoreBgRenderer'
import type { TCoreBgPreviewSubscriber } from '~/widgets/CoreBgRenderer/spec'

import type { TProps } from './spec'

export default function WallpaperRenderer({
  className,
  patternSize = 'auto',
  positioned = true,
  textureScale = 1,
}: TProps) {
  const renderSpec = useWallpaperCoreBgRenderSpec()
  const previewSubscriber = useCallback<TCoreBgPreviewSubscriber>(
    (listener) =>
      subscribeWallpaperPreview((state) => {
        listener(state ? resolveWallpaperCoreBgRenderSpec(state) : null)
      }),
    [],
  )

  return (
    <CoreBgRenderer
      className={className}
      renderSpec={renderSpec}
      patternSize={patternSize}
      positioned={positioned}
      previewSubscriber={previewSubscriber}
      textureScale={textureScale}
    />
  )
}
