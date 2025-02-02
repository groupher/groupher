import type { FC } from 'react'

import type { TActive, TMenu } from '~/spec'
import { Trans } from '~/i18n'

import type { TMenuItem } from './spec'
import Icon from './Icon'
import useSalon, { cn } from './salon/item'

type TProps = {
  item: TMenuItem
  withDesc?: boolean
  onClick: () => void
} & TActive

const Item: FC<TProps> = ({ item, withDesc = false, active, onClick }) => {
  const s = useSalon({ active })

  if (withDesc) {
    return (
      <div className={cn(s.wrapper, s.full)} onClick={onClick}>
        <div className={s.fullIconBox}>
          <Icon type={item.icon as TMenu} />
        </div>
        <div className={s.main}>
          <div className={cn(s.title, s.fullTitle)}>{Trans(item.key)}</div>
          <div className={s.desc}>{item.desc || '--'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={s.wrapper} onClick={onClick}>
      <Icon type={item.icon as TMenu} />
      <div className={s.title}>{Trans(item.key)}</div>
    </div>
  )
}

export default Item
