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

export default function TuningZone({ tab }: TProps) {
  const {
    getWallpaper,
    togglePattern,
    toggleShadow,
    changeBlurIntensity,
    changeBrightness,
    changeSaturation,
  } = useLogic()
  const { type, hasPattern, hasShadow, blurIntensity, brightness, saturation } = getWallpaper()
  const { t } = useTrans()
  const s = useSalon()

  const isGradient = type === WALLPAPER_TYPE.GRADIENT || type === WALLPAPER_TYPE.CUSTOM_GRADIENT
  const hasCustomSettings = tab === TAB.DIY || tab === TAB.PICTURES
  const hasRightPanel = isGradient || hasCustomSettings

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
            value={blurIntensity}
            min={0}
            max={100}
            step={5}
            labelPlacement='left'
            valueLabel={t('dsb.appearance.wallpaper.editor.blur')}
            aria-label={t('dsb.appearance.wallpaper.editor.blur')}
            onChange={changeBlurIntensity}
          />
          <RangeInput
            value={brightness}
            min={60}
            max={140}
            step={5}
            labelPlacement='left'
            valueLabel={t('dsb.appearance.wallpaper.editor.brightness')}
            aria-label={t('dsb.appearance.wallpaper.editor.brightness')}
            onChange={changeBrightness}
          />
          <RangeInput
            value={saturation}
            min={0}
            max={160}
            step={5}
            labelPlacement='left'
            valueLabel={t('dsb.appearance.wallpaper.editor.saturation')}
            aria-label={t('dsb.appearance.wallpaper.editor.saturation')}
            onChange={changeSaturation}
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
