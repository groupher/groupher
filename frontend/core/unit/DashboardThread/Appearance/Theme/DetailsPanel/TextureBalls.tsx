import { GLOW_EFFECTS_KEYS } from '~/const/glow_effect'
import useThemeKV from '~/hooks/useThemeKV'
import CloseSVG from '~/icons/CloseLight'

import { PRESET_FIELD } from '../constant'
import useSalon, { cn, cnMerge } from '../salon/details_panel/texture_balls'
import type { TThemePresetOverwrite, TThemePresetTokens } from '../spec'

type TProps = {
  selectedTokens: TThemePresetTokens
  onThemePresetCommit: (overwrite: TThemePresetOverwrite) => void
  rowClassName?: string
}

export default function TextureBalls({
  selectedTokens,
  onThemePresetCommit,
  rowClassName,
}: TProps) {
  const s = useSalon()
  const { key, value } = useThemeKV()

  const glowType = value(selectedTokens, PRESET_FIELD.GLOW_TYPE)
  const glowTypeKey = key(PRESET_FIELD.GLOW_TYPE)

  return (
    <div className={cnMerge(s.row, rowClassName)}>
      <button
        type='button'
        className={cn(s.block, 'align-both', glowType === '' && s.blockActive)}
        aria-pressed={glowType === ''}
        onClick={() => onThemePresetCommit({ [glowTypeKey]: '' })}
      >
        <CloseSVG className={cn(s.icon, 'opacity-60')} />
      </button>

      {GLOW_EFFECTS_KEYS.map((effect) => (
        <button
          key={effect}
          type='button'
          className={cn(s.block, effect === glowType && s.blockActive)}
          aria-pressed={effect === glowType}
          onClick={() => onThemePresetCommit({ [glowTypeKey]: effect })}
        >
          <div className={s.textureBall} style={s.textureStyle()}>
            <div className={s.glowLayer} style={{ background: `${s.glowStyle(effect)}` }} />
          </div>
        </button>
      ))}
    </div>
  )
}
