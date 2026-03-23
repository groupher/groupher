import type { FC } from 'react'
import useTrans from '~/hooks/useTrans'
import type { TActive } from '~/spec'
import Icon from '~/widgets/Menu/Icon'
import useSalon from './salon/active_label'
import type { TActiveCondition, TMenuItem } from './spec'

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
      <div className={s.stateTitle}>{t(activeItem?.title || condition)}</div>
    </div>
  )
}

export default ActiveLabel
