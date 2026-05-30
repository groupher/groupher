import type { ReactNode } from 'react'

import { cn } from '~/css'
import useTrans from '~/hooks/useTrans'
import type { TWallpaperData } from '~/spec'

import useSalon from '../../salon/tuning_panel/detail_panel'
import Basic from './Basic'
import { GROUP } from './constant'
import Content from './Content'
import Gradient from './Gradient'
import Pattern from './Pattern'
import Texture from './Texture'

type TRangeDraft = {
  blurIntensity: number
  patternIntensity: number
  brightness: number
  saturation: number
}

type Props = {
  wallpaper: TWallpaperData
  rangeDraft: TRangeDraft
  isGradient: boolean
  canUseTexture: boolean
  canUseAngle: boolean
  hasRightPanel: boolean
  onTogglePattern: (hasPattern: boolean) => void
  onToggleTexture: (hasTexture: boolean) => void
  onToggleShadow: (hasShadow: boolean) => void
  onPatternToneChange: (lightPattern: boolean) => void
  onBlurIntensityChange: (value: number) => void
  onPatternIntensityChange: (value: number) => void
  onBrightnessChange: (value: number) => void
  onSaturationChange: (value: number) => void
  onRangeChangeEnd: () => void
  onCollapse: () => void
}

export default function DetailPanel({
  wallpaper,
  rangeDraft,
  isGradient,
  canUseTexture,
  canUseAngle,
  hasRightPanel,
  onTogglePattern,
  onToggleTexture,
  onToggleShadow,
  onPatternToneChange,
  onBlurIntensityChange,
  onPatternIntensityChange,
  onBrightnessChange,
  onSaturationChange,
  onRangeChangeEnd,
  onCollapse,
}: Props) {
  const { gradient, hasPattern, patternTone, hasTexture, hasShadow, texture } = wallpaper
  const { t } = useTrans()
  const s = useSalon()
  const groups: Array<{ key: GROUP; node: ReactNode } | null> = [
    {
      key: GROUP.BASIC,
      node: (
        <Basic
          rangeDraft={rangeDraft}
          onBlurIntensityChange={onBlurIntensityChange}
          onBrightnessChange={onBrightnessChange}
          onSaturationChange={onSaturationChange}
          onRangeChangeEnd={onRangeChangeEnd}
        />
      ),
    },
    {
      key: GROUP.CONTENT,
      node: <Content hasShadow={hasShadow} onToggleShadow={onToggleShadow} />,
    },
    isGradient
      ? {
          key: GROUP.PATTERN,
          node: (
            <Pattern
              hasPattern={hasPattern}
              patternTone={patternTone}
              patternIntensity={rangeDraft.patternIntensity}
              onTogglePattern={onTogglePattern}
              onPatternToneChange={onPatternToneChange}
              onPatternIntensityChange={onPatternIntensityChange}
              onRangeChangeEnd={onRangeChangeEnd}
            />
          ),
        }
      : null,
    canUseTexture
      ? {
          key: GROUP.TEXTURE,
          node: (
            <Texture hasTexture={hasTexture} texture={texture} onToggleTexture={onToggleTexture} />
          ),
        }
      : null,
    isGradient
      ? {
          key: GROUP.GRADIENT,
          node: <Gradient gradient={gradient} canUseAngle={canUseAngle} />,
        }
      : null,
  ]
  const visibleGroups = groups.filter((group) => group !== null) as Array<{
    key: GROUP
    node: ReactNode
  }>

  // Split visible groups after conditional filtering so odd counts always leave
  // the left column with one extra group instead of making the right column heavier.
  const leftColumnCount = Math.ceil(visibleGroups.length / 2)
  const leftGroups = visibleGroups.slice(0, leftColumnCount)
  const rightGroups = visibleGroups.slice(leftColumnCount)

  return (
    <div className={s.wrapper}>
      <div className={cn(s.inner, hasRightPanel ? s.wrapperTwoColumns : s.wrapperOneColumn)}>
        <div className={s.column}>
          {leftGroups.map(({ key, node }) => (
            <div key={key}>{node}</div>
          ))}
        </div>

        {hasRightPanel && rightGroups.length > 0 && (
          <div className={s.column}>
            {rightGroups.map(({ key, node }) => (
              <div key={key}>{node}</div>
            ))}
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
