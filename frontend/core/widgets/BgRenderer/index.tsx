'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { TBgRenderSpec } from '~/lib/bg'

import BgLayer from './BgLayer'
import { getVisualIdentity, preloadImage, shouldCrossfade } from './helper'
import useSalon from './salon'
import type { TProps } from './spec'
import { cnMerge } from '~/css'

/**
 * Shared runtime renderer for Bg backgrounds.
 *
 * This is used for the global Wallpaper through `WallpaperRenderer`, and it is
 * also the component CoverEditor should use for background previews/runtime
 * rendering once Cover adopts Bg. It receives a render spec instead of
 * reading module stores, so business adapters stay outside the common layer.
 *
 * @example
 * const renderSpec = composeBgRenderSpec(bg)
 * return <BgRenderer renderSpec={renderSpec} />
 */
export default function BgRenderer({
  className,
  renderSpec,
  patternSize = 'auto',
  positioned = true,
  previewSubscriber,
  textureScale = 1,
}: TProps) {
  const s = useSalon()
  const [activeSpec, setActiveSpec] = useState<TBgRenderSpec>(renderSpec)
  const [exitingSpec, setExitingSpec] = useState<TBgRenderSpec | null>(null)
  const committedSpecRef = useRef(renderSpec)
  const activeSpecRef = useRef(renderSpec)
  const transitionTokenRef = useRef(0)

  const applySpec = useCallback((nextSpec: TBgRenderSpec) => {
    const previousSpec = activeSpecRef.current
    const shouldAnimate = shouldCrossfade(previousSpec, nextSpec)
    const transitionToken = transitionTokenRef.current + 1
    transitionTokenRef.current = transitionToken

    if (!shouldAnimate) {
      activeSpecRef.current = nextSpec
      setActiveSpec(nextSpec)
      setExitingSpec(null)
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
    <div className={cnMerge(positioned && s.wrapperPositioned, s.wrapper, className)} aria-hidden='true'>
      <BgLayer renderSpec={activeSpec} patternSize={patternSize} textureScale={textureScale} />
      {exitingSpec && (
        <BgLayer
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
