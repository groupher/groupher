import { useState } from 'react'

import { THEME_PRESET_OPTIONS } from '~/const/theme_preset'

import PresetCard from './PresetCard'
import useSalon, { ROTATE_ANGLES } from './salon/preset_list'
import type { TThemePresetOption } from './spec'

type TProps = {
  activePreset: string
  onSelect: (preset: TThemePresetOption) => void
}

export default function PresetList({ activePreset, onSelect }: TProps) {
  const s = useSalon()
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null)

  return (
    <div className={s.presetList}>
      {THEME_PRESET_OPTIONS.map((preset, index) => {
        const active = preset.value === activePreset

        return (
          <PresetCard
            key={preset.value}
            preset={preset}
            active={active}
            activeSuppressed={active && hoveredPreset !== null && hoveredPreset !== preset.value}
            rotateAngle={ROTATE_ANGLES[index] ?? 0}
            onHover={setHoveredPreset}
            onSelect={onSelect}
          />
        )
      })}
    </div>
  )
}
