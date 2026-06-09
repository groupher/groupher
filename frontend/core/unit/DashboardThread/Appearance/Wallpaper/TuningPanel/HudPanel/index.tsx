import SIZE from '~/const/size'
import ArrowSVG from '~/icons/ArrowSimple'
import CheckerSVG from '~/icons/Checker'
import { GRADIENT_RENDERER } from '~/lib/wallpaperMesh'
import type { TWallpaperData } from '~/spec'
import ColorsPresetBall from '~/widgets/ColorsPresetBall'

import SwatchPreview from '../../TextureStylePicker/SwatchPreview'
import useSalon from '../salon/hud_panel'

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
  const renderer = isGradient && canUseAngle ? wallpaper.gradient?.renderer : null
  const showDirection = renderer && renderer !== GRADIENT_RENDERER.RADIAL
  const gradientColors = isGradient ? (wallpaper.gradient?.colors ?? []) : []

  return (
    <div className={s.wrapper}>
      <div className={s.hudItems}>
        {isGradient && hasPattern && (
          <div className={s.hudItem}>
            <span className={s.hudLabel}>Pattern</span>
            <span className={s.hudSwatchWrap}>
              <CheckerSVG className={s.hudPatternIcon} />
            </span>
          </div>
        )}

        {renderer && (
          <div className={s.hudItem}>
            <span className={s.hudLabel}>{renderer}</span>
            {showDirection && (
              <span className={s.hudAngle}>
                <span className={s.hudAngleRing}>
                  <span className={s.hudAngleDot} style={{ transform: `rotate(${angle}deg)` }} />
                </span>
              </span>
            )}
          </div>
        )}

        {canUseTexture && hasTexture && (
          <div className={s.hudItem}>
            <span className={s.hudLabel}>Texture</span>
            <span className={s.hudSwatchWrap}>
              <SwatchPreview type={texture.type} variant='hud' />
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

        {gradientColors.length > 0 && (
          <ColorsPresetBall colors={gradientColors} label='Gradient colors' size={SIZE.TINY} />
        )}

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
