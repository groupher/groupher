import type { FC } from 'react'

import type { TActive } from '~/spec'

import { Trans } from '~/i18n'
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

  return (
    <div className={s.label}>
      {activeItem && <Icon type={activeItem.icon} $active={$active} />}
      <div className={s.stateTitle}>{Trans(condition)}</div>
    </div>
  )
}

export default ActiveLabel
