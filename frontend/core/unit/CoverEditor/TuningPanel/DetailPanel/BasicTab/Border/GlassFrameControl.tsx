import CheckSVG from '~/icons/Check'

import useSalon, { cn } from './salon/glass_frame_control'

type TProps = {
  enabled: boolean
  onToggle: () => void
}

export default function GlassFrameControl({ enabled, onToggle }: TProps) {
  const s = useSalon()

  return (
    <button
      type='button'
      className={cn(s.control, enabled && s.controlActive)}
      aria-label='Glass frame'
      aria-pressed={enabled}
      onClick={onToggle}
    >
      <span className={s.verticalLine} style={{ left: '33.333%' }} />
      <span className={s.verticalLine} style={{ left: '66.667%' }} />
      <span className={s.horizontalLine} style={{ top: '50%' }} />
      <span className={cn(s.center, enabled && s.centerActive)}>
        {enabled && <CheckSVG className={s.checkIcon} />}
      </span>
    </button>
  )
}
