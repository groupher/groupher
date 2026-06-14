import type { FC } from 'react'

import type { FOOTER_ACTIONS } from './constant'
import useSalon from './salon/action_button'

type TAction = (typeof FOOTER_ACTIONS)[number]

type TProps = {
  action: TAction
}

const ActionButton: FC<TProps> = ({ action }) => {
  const s = useSalon()
  const { Icon, label, count } = action

  return (
    <button type='button' className={s.wrapper} aria-label={label} title={label}>
      <Icon className={s.icon} />
      {count && <span className={s.count}>{count}</span>}
    </button>
  )
}

export default ActionButton
