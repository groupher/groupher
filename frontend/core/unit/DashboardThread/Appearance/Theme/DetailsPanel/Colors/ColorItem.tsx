import { COLOR } from '~/const/colors'
import type { TColorName } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'

import useSalon from '../../salon/details_panel/colors/color_item'
import type { TThemePresetOverwrite } from '../../spec'
import { findPresetColor, resolvePresetColor, type TThemeMode } from './helper'

type TProps = {
  color: string
  desc: string
  field: keyof TThemePresetOverwrite
  isLarge?: boolean
  theme: TThemeMode
  title: string
  onThemePresetCommit: (patch: Partial<TThemePresetOverwrite>) => void
}

export default function ColorItem({
  color,
  desc,
  field,
  isLarge = false,
  theme,
  title,
  onThemePresetCommit,
}: TProps) {
  const s = useSalon({ isLarge })

  const handlePresetChange = (selectedColor: TColorName) => {
    if (selectedColor === COLOR.CUSTOM) return

    onThemePresetCommit({ [field]: resolvePresetColor(selectedColor, theme) })
  }

  const handleCustomChange = (customColor: string) => {
    onThemePresetCommit({
      [field]: customColor,
    })
  }

  return (
    <div className={s.item}>
      <div className={s.head}>
        <div className={s.ballWrapper} style={{ borderColor: color }}>
          <ColorSelector
            activeColor={findPresetColor(color, theme)}
            customColor={color}
            allowCustomColor
            onChange={handlePresetChange}
            onCustomColorChange={handleCustomChange}
          >
            <div className={s.colorBall} style={{ backgroundColor: color }} />
          </ColorSelector>
        </div>
        <div className={s.title}>{title}</div>
      </div>
      <p className={s.desc}>{desc}</p>
    </div>
  )
}
