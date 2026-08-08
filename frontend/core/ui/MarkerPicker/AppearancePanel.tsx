import { type FC, useState } from 'react'

import { MARKER } from '~/const/marker'
import THEME from '~/const/theme'
import useOverlayDark from '~/hooks/useOverlayDark'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import type { TMarkerValue, TThemeName } from '~/spec'
import ThemeSwitchPreview from '~/ui/ThemeSwitch/Preview'

import ColorRow from './ColorRow'
import { APPEARANCE_CHANNEL, MARKER_POPOVER_SURFACE_COLOR } from './constant'
import {
  getAppearanceValue,
  getCustomColorFallback,
  getPresetHex,
  isCustomAppearanceValue,
  type TAppearanceChannel,
  type TAppearanceColor,
  updateMarkerAppearance,
} from './helper'
import useSalon from './salon/appearance_panel'

type TProps = {
  value: TMarkerValue
  onChange: (value: TMarkerValue) => void
}

type TCustomExpanded = Record<TThemeName, Record<TAppearanceChannel, boolean>>

const AppearancePanel: FC<TProps> = ({ value, onChange }) => {
  const s = useSalon()
  const { t } = useTrans()
  const { theme, isDarkTheme } = useTheme()
  const overlayDark = useOverlayDark()
  const [customExpanded, setCustomExpanded] = useState<TCustomExpanded>(() => ({
    [THEME.LIGHT]: {
      [APPEARANCE_CHANNEL.COLOR]: false,
      [APPEARANCE_CHANNEL.BG]: false,
    },
    [THEME.DARK]: {
      [APPEARANCE_CHANNEL.COLOR]: false,
      [APPEARANCE_CHANNEL.BG]: false,
    },
  }))
  const themeAppearance = value.appearance?.[theme]
  const supportsColor = value.type === MARKER.ICON && value.provider !== 'dev'
  const surfaceTheme = overlayDark || isDarkTheme ? THEME.DARK : THEME.LIGHT
  const surfaceColor = MARKER_POPOVER_SURFACE_COLOR[surfaceTheme]

  const changeValue = (channel: TAppearanceChannel, hex: string) => {
    onChange(updateMarkerAppearance(value, theme, channel, hex))
  }

  const handlePresetSelect = (channel: TAppearanceChannel, color: TAppearanceColor) => {
    setCustomExpanded((current) => ({
      ...current,
      [theme]: { ...current[theme], [channel]: false },
    }))
    changeValue(channel, getPresetHex(theme, channel, color))
  }

  const handleCustomSelect = (channel: TAppearanceChannel) => {
    const fallback = getCustomColorFallback(themeAppearance, theme, channel)
    if (!getAppearanceValue(value, theme, channel)) changeValue(channel, fallback)
    setCustomExpanded((current) => ({
      ...current,
      [theme]: { ...current[theme], [channel]: true },
    }))
  }

  const isCustomExpanded = (channel: TAppearanceChannel): boolean => {
    const currentValue = getAppearanceValue(value, theme, channel)
    return customExpanded[theme][channel] || isCustomAppearanceValue(currentValue, theme, channel)
  }

  return (
    <div className={s.wrapper}>
      <div className={s.themeSwitch}>
        <ThemeSwitchPreview />
      </div>

      <div className={s.rows}>
        {supportsColor && (
          <ColorRow
            title={t('dsb.marker_picker.icon_color')}
            theme={theme}
            channel={APPEARANCE_CHANNEL.COLOR}
            value={getAppearanceValue(value, theme, APPEARANCE_CHANNEL.COLOR)}
            customColor={getCustomColorFallback(themeAppearance, theme, APPEARANCE_CHANNEL.COLOR)}
            customExpanded={isCustomExpanded(APPEARANCE_CHANNEL.COLOR)}
            surfaceColor={surfaceColor}
            onPresetSelect={(color) => handlePresetSelect(APPEARANCE_CHANNEL.COLOR, color)}
            onCustomSelect={() => handleCustomSelect(APPEARANCE_CHANNEL.COLOR)}
            onCustomChange={(hex) => changeValue(APPEARANCE_CHANNEL.COLOR, hex)}
          />
        )}

        <ColorRow
          title={t('dsb.broadcast.global.background')}
          theme={theme}
          channel={APPEARANCE_CHANNEL.BG}
          value={getAppearanceValue(value, theme, APPEARANCE_CHANNEL.BG)}
          customColor={getCustomColorFallback(themeAppearance, theme, APPEARANCE_CHANNEL.BG)}
          customExpanded={isCustomExpanded(APPEARANCE_CHANNEL.BG)}
          surfaceColor={surfaceColor}
          onPresetSelect={(color) => handlePresetSelect(APPEARANCE_CHANNEL.BG, color)}
          onCustomSelect={() => handleCustomSelect(APPEARANCE_CHANNEL.BG)}
          onCustomChange={(hex) => changeValue(APPEARANCE_CHANNEL.BG, hex)}
        />
      </div>
    </div>
  )
}

export default AppearancePanel
