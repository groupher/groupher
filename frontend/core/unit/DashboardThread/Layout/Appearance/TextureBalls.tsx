import { GLOW_EFFECTS_KEYS } from '~/const/glow_effect'
import ClossSVG from '~/icons/CloseLight'

import { FIELD } from '../../constant'
import type useGlowLight from '../../logic/useGlowLight'
import useSalon, { cn, cnMerge } from './salon/texture_balls'

type TGlowLight = ReturnType<typeof useGlowLight>

type TProps = {
  glowType: TGlowLight['glowType']
  edit: TGlowLight['edit']
  rowClassName?: string
}

export default function TextureBalls({ glowType, edit, rowClassName }: TProps) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.row, rowClassName)}>
      <button
        type='button'
        className={cn(s.block, 'align-both', glowType === '' && s.blockActive)}
        aria-pressed={glowType === ''}
        onClick={() => edit('', FIELD.GLOW_TYPE)}
      >
        <ClossSVG className={cn(s.icon, 'opacity-60')} />
      </button>

      {GLOW_EFFECTS_KEYS.map((effect) => (
        <button
          key={effect}
          type='button'
          className={cn(s.block, effect === glowType && s.blockActive)}
          aria-pressed={effect === glowType}
          onClick={() => edit(effect, FIELD.GLOW_TYPE)}
        >
          <div className={s.textureBall} style={s.textureStyle()}>
            <div className={s.glowLayer} style={{ background: `${s.glowStyle(effect)}` }} />
          </div>
        </button>
      ))}
    </div>
  )
}
