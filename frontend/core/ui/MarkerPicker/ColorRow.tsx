import { AnimatePresence, m } from 'motion/react'
import type { FC } from 'react'

import HookSVG from '~/icons/Hook'
import type { TThemeName } from '~/spec'
import CustomColor from '~/ui/ColorSelector/CustomColor'
import CustomColorPicker from '~/ui/ColorSelector/CustomColorPicker'

import { APPEARANCE_COLORS } from './constant'
import {
  findAppearancePreset,
  getPresetHex,
  getReadableCheckColor,
  type TAppearanceChannel,
} from './helper'
import useSalon, { cn } from './salon/color_row'

type TProps = {
  title: string
  theme: TThemeName
  channel: TAppearanceChannel
  value?: string
  customColor: string
  customExpanded: boolean
  surfaceColor: string
  onPresetSelect: (color: (typeof APPEARANCE_COLORS)[number]) => void
  onCustomSelect: () => void
  onCustomChange: (hex: string) => void
}

const ColorRow: FC<TProps> = ({
  title,
  theme,
  channel,
  value,
  customColor,
  customExpanded,
  surfaceColor,
  onPresetSelect,
  onCustomSelect,
  onCustomChange,
}) => {
  const s = useSalon()
  const activePreset = findAppearancePreset(value, theme, channel)
  const customSelected = customExpanded || Boolean(value && !activePreset)

  return (
    <section className={s.wrapper}>
      <div className={s.title}>{title}</div>
      <div className={s.colors}>
        {APPEARANCE_COLORS.map((color) => {
          const selected = activePreset === color && !customExpanded
          const presetHex = getPresetHex(theme, channel, color)

          return (
            <button
              key={color}
              type='button'
              aria-label={color}
              aria-pressed={selected}
              className={s.swatchButton}
              onClick={() => onPresetSelect(color)}
            >
              <span
                className={cn(s.swatch, selected && s.swatchActive)}
                style={{ backgroundColor: presetHex }}
              >
                {selected && (
                  <HookSVG
                    className={s.checkIcon}
                    style={{ fill: getReadableCheckColor(presetHex, surfaceColor) }}
                  />
                )}
              </span>
            </button>
          )
        })}

        <div className={s.customSlot}>
          <CustomColor
            color={customColor}
            selected={customSelected}
            checkColor={getReadableCheckColor(customColor, surfaceColor)}
            roomy
            onClick={onCustomSelect}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {customExpanded && (
          <m.div
            key={channel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className={s.customMotion}
          >
            <div className={s.customPicker}>
              <CustomColorPicker
                color={customColor}
                showThemeSwitch={false}
                onChange={onCustomChange}
              />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export default ColorRow
