import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'

import type { FOOTER_ACTIONS } from './constant'
import useSalon from './salon/action_button'

type TAction = (typeof FOOTER_ACTIONS)[number]

type TProps = {
  action: TAction
}

const ActionButton: FC<TProps> = ({ action }) => {
  const s = useSalon()
  const { t } = useTrans()
  const { Icon, label, count } = action
  const text = t(label)

  return (
    <button type='button' className={s.wrapper} aria-label={text} title={text}>
      <Icon className={s.icon} />
      {count && <span className={s.count}>{count}</span>}
    </button>
  )
}

export default ActionButton
