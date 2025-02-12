import type { FC } from 'react'

import type { TSizeSM } from '~/spec'
import SIZE from '~/const/size'

import HookSVG from '~/icons/CheckBold'

import useSalon from './salon/toggle_switch'

type TProps = {
  size?: TSizeSM
  checked?: boolean
  onChange?: (checked: boolean) => void
}

const ToggleSwitch: FC<TProps> = ({
  size = SIZE.SMALL,
  checked = false,
  onChange = console.log,
}) => {
  const s = useSalon({ size, checked })

  return (
    <div className={s.wrapper} onClick={() => onChange(!checked)}>
      <div className={s.track}>
        <div className={s.indicator}>
          <HookSVG className={s.checkIcon} />
        </div>
      </div>
    </div>
  )
}

export default ToggleSwitch
