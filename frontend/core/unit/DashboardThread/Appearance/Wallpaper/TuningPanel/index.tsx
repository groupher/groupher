import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { WALLPAPER_PATTERN_TONE, WALLPAPER_TYPE } from '~/const/wallpaper'

import { isGradientWallpaper } from '../helper'
import useSalon from '../salon/tuning_panel'
import useLogic from '../useLogic'
import DetailPanel from './DetailPanel'
import HudPanel from './HudPanel'

type TRangeDraft = {
  blurIntensity: number
  patternIntensity: number
  brightness: number
  saturation: number
}

export default function TuningPanel() {
  const {
    getWallpaper,
    angleDraft,
    togglePattern,
    toggleTexture,
    toggleShadow,
    changeBlurIntensity,
    changePatternIntensity,
    changePatternTone,
    changeBrightness,
    changeSaturation,
    flushWallpaperDraft,
  } = useLogic()
  const wallpaper = getWallpaper()
  const { type, blurIntensity, patternIntensity, brightness, saturation } = wallpaper
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [panelHeight, setPanelHeight] = useState<number | null>(null)
  const [rangeDraft, setRangeDraft] = useState<TRangeDraft>({
    blurIntensity,
    patternIntensity,
    brightness,
    saturation,
  })

  const s = useSalon()

  const isGradient = type === WALLPAPER_TYPE.GRADIENT
  const isPicture = type === WALLPAPER_TYPE.PATTERN
  const isUpload = type === WALLPAPER_TYPE.UPLOAD
  const canUseTexture = isGradient || isPicture || isUpload
  const canUseAngle = isGradientWallpaper(wallpaper)
  const hasRightPanel = canUseTexture

  useLayoutEffect(() => {
    const node = contentRef.current
    if (!node) return

    const updateHeight = (): void => {
      setPanelHeight(node.getBoundingClientRect().height)
    }

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(node)

    return () => observer.disconnect()
  }, [expanded, type])

  useEffect(() => {
    setRangeDraft({
      blurIntensity,
      patternIntensity,
      brightness,
      saturation,
    })
  }, [blurIntensity, patternIntensity, brightness, saturation])

  const handleBlurIntensityChange = (value: number): void => {
    setRangeDraft((current) => ({ ...current, blurIntensity: value }))
    changeBlurIntensity(value)
  }

  const handlePatternIntensityChange = (value: number): void => {
    setRangeDraft((current) => ({ ...current, patternIntensity: value }))
    changePatternIntensity(value)
  }

  const handlePatternToneChange = (lightPattern: boolean): void => {
    changePatternTone(lightPattern ? WALLPAPER_PATTERN_TONE.LIGHT : WALLPAPER_PATTERN_TONE.DARK)
  }

  const handleBrightnessChange = (value: number): void => {
    setRangeDraft((current) => ({ ...current, brightness: value }))
    changeBrightness(value)
  }

  const handleSaturationChange = (value: number): void => {
    setRangeDraft((current) => ({ ...current, saturation: value }))
    changeSaturation(value)
  }

  if (type === WALLPAPER_TYPE.NONE) return null

  return (
    <div className={s.wrapper} style={{ height: panelHeight ?? undefined }}>
      <div ref={contentRef} className={s.panelContent}>
        {!expanded && (
          <HudPanel
            wallpaper={wallpaper}
            angle={angleDraft}
            isGradient={isGradient}
            canUseAngle={canUseAngle}
            canUseTexture={canUseTexture}
            onExpand={() => setExpanded(true)}
          />
        )}

        {expanded && (
          <DetailPanel
            wallpaper={wallpaper}
            rangeDraft={rangeDraft}
            isGradient={isGradient}
            isPicture={isPicture}
            isUpload={isUpload}
            canUseTexture={canUseTexture}
            canUseAngle={canUseAngle}
            hasRightPanel={hasRightPanel}
            onTogglePattern={togglePattern}
            onToggleTexture={toggleTexture}
            onToggleShadow={toggleShadow}
            onPatternToneChange={handlePatternToneChange}
            onBlurIntensityChange={handleBlurIntensityChange}
            onPatternIntensityChange={handlePatternIntensityChange}
            onBrightnessChange={handleBrightnessChange}
            onSaturationChange={handleSaturationChange}
            onRangeChangeEnd={flushWallpaperDraft}
            onCollapse={() => setExpanded(false)}
          />
        )}
      </div>
    </div>
  )
}
