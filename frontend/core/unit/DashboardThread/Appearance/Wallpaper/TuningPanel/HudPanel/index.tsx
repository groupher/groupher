import ArrowSVG from '~/icons/ArrowSimple'
import type { TWallpaperData } from '~/spec'

import useSalon from '../../salon/tuning_panel/hud_panel'
import TextureSwatchPreview from '../../TextureStylePicker/TextureSwatchPreview'

type Props = {
  wallpaper: TWallpaperData
  angle: number
  isGradient: boolean
  canUseAngle: boolean
  canUseTexture: boolean
  onExpand: () => void
}

export default function HudPanel({
  wallpaper,
  angle,
  isGradient,
  canUseAngle,
  canUseTexture,
  onExpand,
}: Props) {
  const s = useSalon()
  const { hasPattern, hasTexture, hasShadow, blurIntensity, brightness, saturation, texture } =
    wallpaper

  return (
    <div className={s.wrapper}>
      <div className={s.hudItems}>
        {isGradient && hasPattern && (
          <div className={s.hudItem}>
            <span className={s.hudLabel}>Pattern</span>
            <span className={s.hudSwatchWrap}>
              <span className={s.hudPatternSwatch} />
            </span>
          </div>
        )}

        {isGradient && canUseAngle && (
          <div className={s.hudItem}>
            <span className={s.hudLabel}>Angle</span>
            <span className={s.hudAngle}>
              <span className={s.hudAngleRing}>
                <span className={s.hudAngleDot} style={{ transform: `rotate(${angle}deg)` }} />
              </span>
            </span>
          </div>
        )}

        {canUseTexture && hasTexture && (
          <div className={s.hudItem}>
            <span className={s.hudLabel}>Texture</span>
            <span className={s.hudSwatchWrap}>
              <TextureSwatchPreview type={texture.type} variant='hud' />
            </span>
          </div>
        )}

        <div className={s.hudItem}>
          <span className={s.hudLabel}>Blur</span>
          <span className={s.hudValue}>{blurIntensity}</span>
        </div>

        <div className={s.hudItem}>
          <span className={s.hudLabel}>Bright</span>
          <span className={s.hudValue}>{brightness}</span>
        </div>

        <div className={s.hudItem}>
          <span className={s.hudLabel}>Sat</span>
          <span className={s.hudValue}>{saturation}</span>
        </div>

        {hasShadow && (
          <div className={s.hudItem}>
            <span className={s.hudLabel}>Shadow</span>
            <span className={s.hudValue}>on</span>
          </div>
        )}
      </div>

      <button
        type='button'
        className={s.expandBtn}
        aria-expanded={false}
        aria-label='Expand wallpaper tuning panel'
        onClick={onExpand}
      >
        <ArrowSVG className={s.expandIcon} />
      </button>
    </div>
  )
}
