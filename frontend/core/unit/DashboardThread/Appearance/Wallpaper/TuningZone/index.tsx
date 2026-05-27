import { useEffect, useState } from 'react'

import SIZE from '~/const/size'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { cn } from '~/css'
import useTrans from '~/hooks/useTrans'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import RangeInput from '~/widgets/RangeInput'

import { TAB } from '../constant'
import { DiySettings } from '../DiyTab'
import { PictureTextureSettings } from '../PicturesTab'
import useSalon from '../salon/tuning_zone'
import type { TTab } from '../spec'
import useLogic from '../useLogic'
import AngleWheel from './AngleWheel'
import GradientTextureSettings from './GradientTextureSettings'

type TProps = {
  tab: TTab
}

type TRangeDraft = {
  blurIntensity: number
  brightness: number
  saturation: number
}

export default function TuningZone({ tab }: TProps) {
  const {
    getWallpaper,
    togglePattern,
    toggleShadow,
    changeBlurIntensity,
    changeBrightness,
    changeSaturation,
    flushWallpaperDraft,
  } = useLogic()
  const { type, hasPattern, hasShadow, blurIntensity, brightness, saturation } = getWallpaper()
  const { t } = useTrans()
  const s = useSalon()
  const [rangeDraft, setRangeDraft] = useState<TRangeDraft>({
    blurIntensity,
    brightness,
    saturation,
  })

  const isGradient = type === WALLPAPER_TYPE.GRADIENT || type === WALLPAPER_TYPE.MESH
  const hasCustomSettings = tab === TAB.DIY || tab === TAB.PICTURES
  const hasRightPanel = isGradient || hasCustomSettings

  useEffect(() => {
    setRangeDraft({
      blurIntensity,
      brightness,
      saturation,
    })
  }, [blurIntensity, brightness, saturation])

  const handleBlurIntensityChange = (value: number): void => {
    setRangeDraft((current) => ({ ...current, blurIntensity: value }))
    changeBlurIntensity(value)
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
    <div className={cn(s.wrapper, hasRightPanel ? s.wrapperTwoColumns : s.wrapperOneColumn)}>
      <div className={s.effects}>
        <div className={s.topControls}>
          <div className={s.toggleRows}>
            {isGradient && (
              <div className={s.switchWrapper}>
                <div className={s.toggleTitle}>{t('dsb.appearance.wallpaper.editor.pattern')}</div>
                <ToggleSwitch size={SIZE.TINY} checked={hasPattern} onChange={togglePattern} />
              </div>
            )}

            <div className={s.switchWrapper}>
              <div className={s.toggleTitle}>{t('dsb.appearance.wallpaper.editor.shadow')}</div>
              <ToggleSwitch size={SIZE.TINY} checked={hasShadow} onChange={toggleShadow} />
            </div>
          </div>

          {isGradient && (
            <div className={s.angleSettings}>
              <AngleWheel />
            </div>
          )}
        </div>

        <div className={s.rangeRows}>
          <RangeInput
            value={rangeDraft.blurIntensity}
            min={0}
            max={100}
            step={5}
            labelPlacement='left'
            valueLabel={t('dsb.appearance.wallpaper.editor.blur')}
            aria-label={t('dsb.appearance.wallpaper.editor.blur')}
            onChange={handleBlurIntensityChange}
            onChangeEnd={flushWallpaperDraft}
          />
          <RangeInput
            value={rangeDraft.brightness}
            min={60}
            max={140}
            step={5}
            labelPlacement='left'
            valueLabel={t('dsb.appearance.wallpaper.editor.brightness')}
            aria-label={t('dsb.appearance.wallpaper.editor.brightness')}
            onChange={handleBrightnessChange}
            onChangeEnd={flushWallpaperDraft}
          />
          <RangeInput
            value={rangeDraft.saturation}
            min={0}
            max={160}
            step={5}
            labelPlacement='left'
            valueLabel={t('dsb.appearance.wallpaper.editor.saturation')}
            aria-label={t('dsb.appearance.wallpaper.editor.saturation')}
            onChange={handleSaturationChange}
            onChangeEnd={flushWallpaperDraft}
          />
        </div>
      </div>

      {hasRightPanel && (
        <div className={s.rightPanel}>
          {tab === TAB.GRADIENT && (
            <div className={s.customSettings}>
              <GradientTextureSettings />
            </div>
          )}

          {tab === TAB.DIY && (
            <div className={s.customSettings}>
              <DiySettings />
            </div>
          )}

          {tab === TAB.PICTURES && (
            <div className={s.customSettings}>
              <PictureTextureSettings />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
