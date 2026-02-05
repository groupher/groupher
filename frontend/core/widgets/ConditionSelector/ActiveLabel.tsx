import type { FC } from 'react'

import type { TActive } from '~/spec'

import useTrans from '~/hooks/useTrans'
import Icon from '~/widgets/Menu/Icon'

import type { TActiveCondition, TMenuItem } from './spec'

import useSalon from './salon/active_label'

type TProps = {
  condition: TActiveCondition
  activeItem: TMenuItem
} & TActive

const ActiveLabel: FC<TProps> = ({ condition, activeItem }) => {
  const $active = !!condition
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.label}>
      {activeItem && <Icon type={activeItem.icon} $active={$active} />}
      <div className={s.stateTitle}>{t(condition)}</div>
    </div>
  )
}

export default ActiveLabel
