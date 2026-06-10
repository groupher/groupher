import { useEffect, useState } from 'react'

import { COLOR } from '~/const/colors'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import {
  composeColorChips,
  findPresetColor,
  getGradientSpreadValue,
  applyGradientSpreadValue,
} from '~/lib/bg'
import { mapToPresetColorHex } from '~/lib/color'
import {
  GRADIENT_RENDERER,
  WALLPAPER_GRADIENT_RENDERER_OPTIONS,
  type TGradientRecipe,
  type TGradientRenderer,
} from '~/lib/wallpaperMesh'
import type { TColorName } from '~/spec'
import FocalPointControl, { type TPoint } from '~/widgets/FocalPointControl'
import ColorsField from '~/widgets/TuningFields/ColorsField'
import RendererField from '~/widgets/TuningFields/RendererField'
import SpreadField from '~/widgets/TuningFields/SpreadField'

import useLogic from '../../../useLogic'
import useSalon from '../../salon/detail_panel/gradient'
import AngleWheel from '../AngleWheel'
import GroupItem from '../GroupItem'
import GroupTitle from '../GroupTitle'

type Props = {
  gradient: TGradientRecipe | null
  canUseAngle: boolean
}

export default function Gradient({ gradient, canUseAngle }: Props) {
  const { t } = useTrans()
  const { theme } = useTheme()
  const { scheduleWallpaperPreview, flushWallpaperDraft, changeGradientRenderer } = useLogic()
  const s = useSalon()
  const [draftGradient, setDraftGradient] = useState<TGradientRecipe | null>(gradient)
  const activeGradient = draftGradient ?? gradient
  const spread = activeGradient ? getGradientSpreadValue(activeGradient) : 50
  const colorChips = activeGradient ? composeColorChips(activeGradient) : []

  useEffect(() => {
    setDraftGradient(gradient)
  }, [gradient])

  const updateGradient = (nextGradient: TGradientRecipe, flush = false): void => {
    setDraftGradient(nextGradient)
    scheduleWallpaperPreview({ gradient: nextGradient })
    if (flush) flushWallpaperDraft()
  }

  const updateColor = (index: number, color: string): void => {
    if (!activeGradient) return

    updateGradient({
      ...activeGradient,
      colors: activeGradient.colors.map((value, valueIndex) =>
        valueIndex === index ? color : value,
      ),
    })
  }

  const updatePresetColor = (index: number, color: TColorName): void => {
    if (color === COLOR.CUSTOM) return
    updateColor(index, mapToPresetColorHex(color, theme))
  }

  const updateSpreadDraft = (value: number): void => {
    if (!activeGradient) return
    updateGradient(applyGradientSpreadValue(activeGradient, value))
  }

  const commitSpread = (value: number): void => {
    if (!activeGradient) return
    updateGradient(applyGradientSpreadValue(activeGradient, value), true)
  }
  const updateRenderer = (renderer: TGradientRenderer): void => {
    if (!activeGradient || renderer === activeGradient.renderer) return
    changeGradientRenderer(renderer)
  }
  const updateFocalPoint = (center: TPoint): void => {
    if (!activeGradient || activeGradient.renderer !== GRADIENT_RENDERER.RADIAL) return

    const nextGradient = {
      ...activeGradient,
      center,
    }
    setDraftGradient(nextGradient)
    scheduleWallpaperPreview({ gradient: nextGradient })
  }

  if (!activeGradient) return null

  return (
    <section className={s.wrapper}>
      <GroupTitle>{t('dsb.appearance.wallpaper.editor.gradient')}</GroupTitle>

      <div className={s.items}>
        <ColorsField
          label={t('dsb.appearance.wallpaper.editor.colors')}
          chips={colorChips.map(({ color, index, key }) => ({
            color,
            activeColor: findPresetColor(color, theme),
            key,
            label: `${t('dsb.appearance.wallpaper.editor.change_gradient_color')} ${index + 1}`,
            onChange: (selectedColor) => updatePresetColor(index, selectedColor),
            onCustomColorChange: (customColor) => updateColor(index, customColor),
          }))}
        />

        <RendererField
          label={t('dsb.appearance.wallpaper.editor.renderer')}
          value={activeGradient.renderer}
          options={WALLPAPER_GRADIENT_RENDERER_OPTIONS.map(({ renderer, labelKey }) => ({
            renderer,
            label: t(labelKey),
          }))}
          onChange={updateRenderer}
        />

        <SpreadField value={spread} onChange={updateSpreadDraft} onChangeEnd={commitSpread} />

        {activeGradient.renderer === GRADIENT_RENDERER.RADIAL && (
          <GroupItem label={t('dsb.appearance.wallpaper.editor.focal_point')} align='start'>
            <FocalPointControl
              value={activeGradient.center}
              label={t('dsb.appearance.wallpaper.editor.focal_point')}
              onChange={updateFocalPoint}
              onCommit={flushWallpaperDraft}
            />
          </GroupItem>
        )}

        {canUseAngle && activeGradient.renderer !== GRADIENT_RENDERER.RADIAL && <AngleWheel />}
      </div>
    </section>
  )
}
