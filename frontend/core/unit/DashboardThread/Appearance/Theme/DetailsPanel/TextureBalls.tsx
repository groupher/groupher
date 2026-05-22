import { GLOW_EFFECTS_KEYS } from '~/const/glow_effect'
import ClossSVG from '~/icons/CloseLight'

import { PRESET_FIELD } from '../constant'
import useSalon, { cn, cnMerge } from '../salon/details_panel/texture_balls'
import type { TThemePresetOverwrite } from '../spec'

type TProps = {
  glowType: TThemePresetOverwrite['glowType']
  glowTypeField: typeof PRESET_FIELD.GLOW_TYPE | typeof PRESET_FIELD.GLOW_TYPE_DARK
  onThemePresetCommit: (patch: Partial<TThemePresetOverwrite>) => void
  rowClassName?: string
}

export default function TextureBalls({
  glowType,
  glowTypeField,
  onThemePresetCommit,
  rowClassName,
}: TProps) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.row, rowClassName)}>
      <button
        type='button'
        className={cn(s.block, 'align-both', glowType === '' && s.blockActive)}
        aria-pressed={glowType === ''}
        onClick={() => onThemePresetCommit({ [glowTypeField]: '' })}
      >
        <ClossSVG className={cn(s.icon, 'opacity-60')} />
      </button>

      {GLOW_EFFECTS_KEYS.map((effect) => (
        <button
          key={effect}
          type='button'
          className={cn(s.block, effect === glowType && s.blockActive)}
          aria-pressed={effect === glowType}
          onClick={() => onThemePresetCommit({ [glowTypeField]: effect })}
        >
          <div className={s.textureBall} style={s.textureStyle()}>
            <div className={s.glowLayer} style={{ background: `${s.glowStyle(effect)}` }} />
          </div>
        </button>
      ))}
    </div>
  )
}
