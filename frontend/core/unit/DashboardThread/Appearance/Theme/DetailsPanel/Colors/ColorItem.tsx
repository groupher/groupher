import { COLOR } from '~/const/colors'
import useThemeKV from '~/hooks/useThemeKV'
import useTrans from '~/hooks/useTrans'
import type { TColorName } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'

import useSalon from '../../salon/details_panel/colors/color_item'
import type { TThemePresetOverwrite, TThemePresetTokens } from '../../spec'
import type { TColorDetail } from './constant'
import {
  findPresetColor,
  getContrastBallShadow,
  getContrastRingColor,
  resolvePresetColor,
} from './helper'

type TProps = {
  detail: TColorDetail
  selectedTokens: TThemePresetTokens
  onThemePresetCommit: (overwrite: TThemePresetOverwrite) => void
}

export default function ColorItem({ detail, selectedTokens, onThemePresetCommit }: TProps) {
  const s = useSalon({ isLarge: detail.isLarge })
  const { t } = useTrans()
  const { theme, key, value } = useThemeKV()
  const color = value(selectedTokens, detail.key) as string
  const activeColorKey = key(detail.key)

  const wrapperStyle = {
    borderColor: detail.hasContrastRing ? getContrastRingColor(theme) : color,
  }
  const ballStyle = {
    backgroundColor: color,
    boxShadow: detail.hasContrastRing ? getContrastBallShadow(theme) : undefined,
  }

  const handlePresetChange = (selectedColor: TColorName) => {
    if (selectedColor === COLOR.CUSTOM) return

    onThemePresetCommit({ [activeColorKey]: resolvePresetColor(selectedColor, theme) })
  }

  const handleCustomChange = (customColor: string) => {
    onThemePresetCommit({ [activeColorKey]: customColor })
  }

  return (
    <div className={s.item}>
      <div className={s.head}>
        <div className={s.ballWrapper} style={wrapperStyle}>
          <ColorSelector
            activeColor={findPresetColor(color, theme)}
            customColor={color}
            allowCustomColor
            onChange={handlePresetChange}
            onCustomColorChange={handleCustomChange}
          >
            <div className={s.colorBall} style={ballStyle} />
          </ColorSelector>
        </div>
        <div className={s.title}>{t(detail.i18nTitleKey)}</div>
      </div>
      <p className={s.desc}>{t(detail.i18nDescKey)}</p>
    </div>
  )
}
