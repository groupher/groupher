import SIZE from '~/const/size'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import useTrans from '~/hooks/useTrans'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import RangeInput from '~/widgets/RangeInput'

import { TAB } from '../constant'
import { DiySettings } from '../DiyTab'
import { PictureTextureSettings } from '../PicturesTab'
import useSalon, { cn } from '../salon/tuning_zone'
import type { TTab } from '../spec'
import useLogic from '../useLogic'
import AnglePanel from './AnglePanel'

type TProps = {
  tab: TTab
}

export default function TuningZone({ tab }: TProps) {
  const {
    getWallpaper,
    togglePattern,
    toggleBlur,
    toggleShadow,
    changeBrightness,
    changeSaturation,
  } = useLogic()
  const { type, hasPattern, hasBlur, hasShadow, brightness, saturation } = getWallpaper()
  const { t } = useTrans()
  const s = useSalon()

  const isGradient = type === WALLPAPER_TYPE.GRADIENT || type === WALLPAPER_TYPE.CUSTOM_GRADIENT
  const isPicture = type === WALLPAPER_TYPE.PATTERN || type === WALLPAPER_TYPE.UPLOAD

  if (type === WALLPAPER_TYPE.NONE) return null

  return (
    <div className={s.wrapper}>
      <div className={s.effects}>
        <div className={s.title}>{t('dsb.appearance.wallpaper.editor.effects')}:</div>
        <div className={s.effectRows}>
          {isGradient && (
            <div className={s.switchWrapper}>
              <div className={s.toggleTitle}>{t('dsb.appearance.wallpaper.editor.pattern')}</div>
              <ToggleSwitch size={SIZE.TINY} checked={hasPattern} onChange={togglePattern} />
            </div>
          )}
          <div className={s.switchWrapper}>
            <div className={s.toggleTitle}>{t('dsb.appearance.wallpaper.editor.blur')}</div>
            <ToggleSwitch size={SIZE.TINY} checked={hasBlur} onChange={toggleBlur} />
          </div>

          <div className={s.switchWrapper}>
            <div className={s.toggleTitle}>{t('dsb.appearance.wallpaper.editor.shadow')}</div>
            <ToggleSwitch size={SIZE.TINY} checked={hasShadow} onChange={toggleShadow} />
          </div>

          {isPicture && (
            <div className={s.rangeRows}>
              <RangeInput
                value={brightness}
                min={60}
                max={140}
                step={5}
                valueLabel={`${t('dsb.appearance.wallpaper.editor.brightness')}:`}
                aria-label={t('dsb.appearance.wallpaper.editor.brightness')}
                onChange={changeBrightness}
              />
              <RangeInput
                value={saturation}
                min={0}
                max={160}
                step={5}
                valueLabel={`${t('dsb.appearance.wallpaper.editor.saturation')}:`}
                aria-label={t('dsb.appearance.wallpaper.editor.saturation')}
                onChange={changeSaturation}
              />
            </div>
          )}
        </div>
      </div>

      {isGradient && (
        <div className={s.angleSettings}>
          <div className={cn(s.title, 'mb-2.5')}>
            {t('dsb.appearance.wallpaper.editor.gradient_direction')}:
          </div>
          <AnglePanel />
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
  )
}
