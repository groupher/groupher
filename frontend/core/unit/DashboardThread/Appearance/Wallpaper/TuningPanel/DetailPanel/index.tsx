import SIZE from '~/const/size'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { cn } from '~/css'
import useTrans from '~/hooks/useTrans'
import type { TWallpaperData } from '~/spec'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import RangeInput from '~/widgets/RangeInput'

import useSalon from '../../salon/tuning_panel/details_panel'
import AngleWheel from './AngleWheel'
import GradientTextureFields from './GradientTextureFields'
import PictureTextureFields from './PictureTextureFields'

type TRangeDraft = {
  blurIntensity: number
  brightness: number
  saturation: number
}

type Props = {
  wallpaper: TWallpaperData
  rangeDraft: TRangeDraft
  isGradient: boolean
  isPicture: boolean
  isUpload: boolean
  canUseTexture: boolean
  canUseDirection: boolean
  hasRightPanel: boolean
  onTogglePattern: (hasPattern: boolean) => void
  onToggleTexture: (hasTexture: boolean) => void
  onToggleShadow: (hasShadow: boolean) => void
  onBlurIntensityChange: (value: number) => void
  onBrightnessChange: (value: number) => void
  onSaturationChange: (value: number) => void
  onRangeChangeEnd: () => void
  onCollapse: () => void
}

export default function DetailPanel({
  wallpaper,
  rangeDraft,
  isGradient,
  isPicture,
  isUpload,
  canUseTexture,
  canUseDirection,
  hasRightPanel,
  onTogglePattern,
  onToggleTexture,
  onToggleShadow,
  onBlurIntensityChange,
  onBrightnessChange,
  onSaturationChange,
  onRangeChangeEnd,
  onCollapse,
}: Props) {
  const { type, hasPattern, hasTexture, hasShadow } = wallpaper
  const { t } = useTrans()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.inner, hasRightPanel ? s.wrapperTwoColumns : s.wrapperOneColumn)}>
        <div className={s.effects}>
          <div className={s.topControls}>
            <div className={s.toggleRows}>
              {isGradient && (
                <div className={s.switchWrapper}>
                  <div className={s.toggleTitle}>
                    {t('dsb.appearance.wallpaper.editor.pattern')}
                  </div>
                  <ToggleSwitch size={SIZE.TINY} checked={hasPattern} onChange={onTogglePattern} />
                </div>
              )}

              <div className={s.switchWrapper}>
                <div className={s.toggleTitle}>{t('dsb.appearance.wallpaper.editor.shadow')}</div>
                <ToggleSwitch size={SIZE.TINY} checked={hasShadow} onChange={onToggleShadow} />
              </div>
            </div>

            {isGradient && canUseDirection && (
              <div className={s.angleFields}>
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
              onChange={onBlurIntensityChange}
              onChangeEnd={onRangeChangeEnd}
            />
            <RangeInput
              value={rangeDraft.brightness}
              min={60}
              max={140}
              step={5}
              labelPlacement='left'
              valueLabel={t('dsb.appearance.wallpaper.editor.brightness')}
              aria-label={t('dsb.appearance.wallpaper.editor.brightness')}
              onChange={onBrightnessChange}
              onChangeEnd={onRangeChangeEnd}
            />
            <RangeInput
              value={rangeDraft.saturation}
              min={0}
              max={160}
              step={5}
              labelPlacement='left'
              valueLabel={t('dsb.appearance.wallpaper.editor.saturation')}
              aria-label={t('dsb.appearance.wallpaper.editor.saturation')}
              onChange={onSaturationChange}
              onChangeEnd={onRangeChangeEnd}
            />
          </div>
        </div>

        {hasRightPanel && (
          <div className={s.rightPanel}>
            {canUseTexture && (
              <div className={s.switchWrapper}>
                <div className={s.toggleTitle}>{t('dsb.appearance.wallpaper.texture')}</div>
                <ToggleSwitch size={SIZE.TINY} checked={hasTexture} onChange={onToggleTexture} />
              </div>
            )}

            {type === WALLPAPER_TYPE.GRADIENT && (
              <div className={s.customFields}>
                <GradientTextureFields />
              </div>
            )}

            {(isPicture || isUpload) && (
              <div className={s.customFields}>
                <PictureTextureFields />
              </div>
            )}
          </div>
        )}
      </div>

      <div className={s.collapseRow}>
        <button
          type='button'
          className={s.collapseBtn}
          aria-label='Collapse wallpaper tuning panel'
          onClick={onCollapse}
        >
          {t('tags.fold.collapse')}
        </button>
      </div>
    </div>
  )
}
