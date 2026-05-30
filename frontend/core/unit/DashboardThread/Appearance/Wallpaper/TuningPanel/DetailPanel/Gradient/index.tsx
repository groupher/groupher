import { useEffect, useState } from 'react'

import { COLOR } from '~/const/colors'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import type { TGradientRecipe } from '~/lib/wallpaperMesh'
import type { TColorName } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'
import RangeInput from '~/widgets/RangeInput'

import useSalon from '../../../salon/tuning_panel/detail_panel/gradient'
import useLogic from '../../../useLogic'
import AngleWheel from '../AngleWheel'
import GroupItem from '../GroupItem'
import GroupTitle from '../GroupTitle'
import {
  applyGradientSpreadValue,
  buildColorChips,
  findPresetColor,
  getGradientSpreadValue,
  resolvePresetColor,
} from './helper'

type Props = {
  gradient: TGradientRecipe | null
  canUseAngle: boolean
}

export default function Gradient({ gradient, canUseAngle }: Props) {
  const { t } = useTrans()
  const { theme } = useTheme()
  const { scheduleWallpaperPreview, flushWallpaperDraft } = useLogic()
  const s = useSalon()
  const [draftGradient, setDraftGradient] = useState<TGradientRecipe | null>(gradient)
  const activeGradient = draftGradient ?? gradient
  const spread = activeGradient ? getGradientSpreadValue(activeGradient) : 50
  const colorChips = activeGradient ? buildColorChips(activeGradient) : []

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
    updateColor(index, resolvePresetColor(color, theme))
  }

  const updateSpreadDraft = (value: number): void => {
    if (!activeGradient) return
    updateGradient(applyGradientSpreadValue(activeGradient, value))
  }

  const commitSpread = (value: number): void => {
    if (!activeGradient) return
    updateGradient(applyGradientSpreadValue(activeGradient, value), true)
  }

  if (!activeGradient) return null

  return (
    <section className={s.wrapper}>
      <GroupTitle>{t('dsb.appearance.wallpaper.editor.gradient')}</GroupTitle>

      <div className={s.items}>
        <GroupItem label={t('dsb.appearance.wallpaper.editor.colors')}>
          <div className={s.chips}>
            {colorChips.map(({ color, index, key }) => (
              <ColorSelector
                key={key}
                activeColor={findPresetColor(color, theme)}
                customColor={color}
                allowCustomColor
                placement='top'
                onChange={(selectedColor) => updatePresetColor(index, selectedColor)}
                onCustomColorChange={(customColor) => updateColor(index, customColor)}
              >
                <button
                  type='button'
                  className={s.chip}
                  style={{ backgroundColor: color }}
                  aria-label={`Change gradient color ${index + 1}`}
                />
              </ColorSelector>
            ))}
          </div>
        </GroupItem>

        <GroupItem label={t('dsb.appearance.wallpaper.editor.spread')}>
          <RangeInput
            value={spread}
            min={0}
            max={100}
            step={1}
            hideLabel
            valueLabel={t('dsb.appearance.wallpaper.editor.spread')}
            aria-label={t('dsb.appearance.wallpaper.editor.spread')}
            onChange={updateSpreadDraft}
            onChangeEnd={commitSpread}
          />
        </GroupItem>

        {canUseAngle && (
          <GroupItem label={t('dsb.appearance.wallpaper.editor.gradient_angle')}>
            <div className={s.angle}>
              <AngleWheel />
            </div>
          </GroupItem>
        )}
      </div>
    </section>
  )
}
