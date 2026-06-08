'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { TCoreBgRenderSpec } from '~/lib/coreBg/spec'

import CoreBgLayer from './CoreBgLayer'
import { getVisualIdentity, preloadImage, shouldCrossfade } from './helper'
import useSalon, { cn } from './salon'
import type { TProps } from './spec'

/**
 * Shared runtime renderer for CoreBg backgrounds.
 *
 * This is used for the global Wallpaper through `WallpaperRenderer`, and it is
 * also the component CoverEditor should use for background previews/runtime
 * rendering once Cover adopts CoreBg. It receives a render spec instead of
 * reading module stores, so business adapters stay outside the common layer.
 *
 * @example
 * const renderSpec = resolveCoreBgRenderSpec(bg)
 * return <CoreBgRenderer renderSpec={renderSpec} />
 */
export default function CoreBgRenderer({
  className,
  renderSpec,
  patternSize = 'auto',
  positioned = true,
  previewSubscriber,
  textureScale = 1,
}: TProps) {
  const s = useSalon()
  const [activeSpec, setActiveSpec] = useState<TCoreBgRenderSpec>(renderSpec)
  const [exitingSpec, setExitingSpec] = useState<TCoreBgRenderSpec | null>(null)
  const committedSpecRef = useRef(renderSpec)
  const activeSpecRef = useRef(renderSpec)
  const transitionTokenRef = useRef(0)

  const applySpec = useCallback((nextSpec: TCoreBgRenderSpec) => {
    const previousSpec = activeSpecRef.current
    const shouldAnimate = shouldCrossfade(previousSpec, nextSpec)
    const transitionToken = transitionTokenRef.current + 1
    transitionTokenRef.current = transitionToken

    if (!shouldAnimate) {
      activeSpecRef.current = nextSpec
      setActiveSpec(nextSpec)
      return
    }

    preloadImage(nextSpec).then(() => {
      if (transitionToken !== transitionTokenRef.current) return

      setExitingSpec(previousSpec)
      activeSpecRef.current = nextSpec
      setActiveSpec(nextSpec)
    })
  }, [])

  useEffect(() => {
    committedSpecRef.current = renderSpec
    applySpec(renderSpec)
  }, [applySpec, renderSpec])

  useEffect(() => {
    if (!previewSubscriber) return

    return previewSubscriber((previewSpec) => {
      applySpec(previewSpec ?? committedSpecRef.current)
    })
  }, [applySpec, previewSubscriber])

  return (
    <div className={cn(positioned && s.wrapperPositioned, s.wrapper, className)} aria-hidden='true'>
      <CoreBgLayer renderSpec={activeSpec} patternSize={patternSize} textureScale={textureScale} />
      {exitingSpec && (
        <CoreBgLayer
          key={getVisualIdentity(exitingSpec)}
          renderSpec={exitingSpec}
          exiting
          patternSize={patternSize}
          textureScale={textureScale}
          onExited={() => setExitingSpec(null)}
        />
      )}
    </div>
  )
}
