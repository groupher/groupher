import { COLOR } from '~/const/colors'
import type { TColorName } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'

import useSalon, { type TColorItemSize } from '../salon/colors/color_item'
import type { TThemePresetOverwrite } from '../spec'
import { findPresetColor, resolvePresetColor, type TThemeMode } from './helper'

type TProps = {
  color: string
  desc: string
  field: keyof TThemePresetOverwrite
  size?: TColorItemSize
  theme: TThemeMode
  title: string
  onThemePresetCommit: (patch: Partial<TThemePresetOverwrite>) => void
}

export default function ColorItem({
  color,
  desc,
  field,
  size = 'compact',
  theme,
  title,
  onThemePresetCommit,
}: TProps) {
  const s = useSalon({ size })

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
