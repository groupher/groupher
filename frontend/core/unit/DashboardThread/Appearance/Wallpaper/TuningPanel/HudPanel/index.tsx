import SIZE from '~/const/size'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import CheckerSVG from '~/icons/Checker'
import { GRADIENT_RENDERER } from '~/lib/wallpaperMesh'
import type { TWallpaperData } from '~/spec'
import ColorsPresetBall from '~/widgets/ColorsPresetBall'
import TextureSwatchPreview from '~/widgets/TuningFields/TextureSwatchPreview'

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
  const { t } = useTrans()
  const { contentShadow, effect, pattern, texture } = wallpaper
  const renderer = isGradient && canUseAngle ? wallpaper.gradient?.renderer : null
  const showDirection = renderer && renderer !== GRADIENT_RENDERER.RADIAL
  const gradientColors = isGradient ? (wallpaper.gradient?.colors ?? []) : []

  return (
    <div className={s.wrapper}>
      <div className={s.hudItems}>
        {isGradient && pattern.enabled && (
          <div className={s.hudItem}>
            <span className={s.hudLabel}>{t('dsb.appearance.wallpaper.hud.pattern')}</span>
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

        {canUseTexture && texture.enabled && (
          <div className={s.hudItem}>
            <span className={s.hudLabel}>{t('dsb.appearance.wallpaper.hud.texture')}</span>
            <span className={s.hudSwatchWrap}>
              <TextureSwatchPreview type={texture.type} variant='hud' />
            </span>
          </div>
        )}

        <div className={s.hudItem}>
          <span className={s.hudLabel}>{t('dsb.appearance.wallpaper.hud.blur')}</span>
          <span className={s.hudValue}>{effect.blurIntensity}</span>
        </div>

        <div className={s.hudItem}>
          <span className={s.hudLabel}>{t('dsb.appearance.wallpaper.hud.bright')}</span>
          <span className={s.hudValue}>{effect.brightness}</span>
        </div>

        <div className={s.hudItem}>
          <span className={s.hudLabel}>{t('dsb.appearance.wallpaper.hud.sat')}</span>
          <span className={s.hudValue}>{effect.saturation}</span>
        </div>

        {gradientColors.length > 0 && (
          <ColorsPresetBall
            colors={gradientColors}
            label={t('dsb.appearance.wallpaper.hud.gradient_colors')}
            size={SIZE.TINY}
          />
        )}

        {contentShadow.enabled && (
          <div className={s.hudItem}>
            <span className={s.hudLabel}>{t('dsb.appearance.wallpaper.hud.shadow')}</span>
            <span className={s.hudValue}>{t('dsb.appearance.wallpaper.hud.on')}</span>
          </div>
        )}
      </div>

      <button
        type='button'
        className={s.expandBtn}
        aria-expanded={false}
        aria-label={t('dsb.appearance.wallpaper.hud.expand')}
        onClick={onExpand}
      >
        <ArrowSVG className={s.expandIcon} />
      </button>
    </div>
  )
}
