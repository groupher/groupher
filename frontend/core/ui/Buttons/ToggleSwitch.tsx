import type { FC } from 'react'

import SIZE from '~/const/size'
import HookSVG from '~/icons/CheckBold'
import type { TSizeTSM } from '~/spec'

import useSalon from './salon/toggle_switch'

type TProps = {
  size?: TSizeTSM
  checked?: boolean
  'aria-label'?: string
  onChange?: (checked: boolean) => void
}

const ToggleSwitch: FC<TProps> = ({
  size = SIZE.SMALL,
  checked = false,
  'aria-label': ariaLabel,
  onChange = console.log,
}) => {
  const s = useSalon({ size, checked })

  return (
    <button
      type='button'
      className={s.wrapper}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
    >
      <div className={s.track}>
        <div className={s.indicator}>
          <HookSVG className={s.checkIcon} />
        </div>
      </div>
    </button>
  )
}

export default ToggleSwitch
