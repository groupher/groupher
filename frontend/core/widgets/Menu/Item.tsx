import type { FC } from 'react'
import useTrans from '~/hooks/useTrans'
import type { TActive, TMenu } from '~/spec'
import Icon from './Icon'
import useSalon, { cnMerge } from './salon/item'
import type { TMenuItem } from './spec'

type TProps = {
  item: TMenuItem
  withDesc?: boolean

  onClick: () => void
} & TActive

const Item: FC<TProps> = ({ item, withDesc = false, active, onClick }) => {
  const s = useSalon({ active })
  const { t } = useTrans()

  if (withDesc) {
    return (
      <button type='button' className={cnMerge(s.wrapper, s.full)} onClick={onClick}>
        <div className={s.fullIconBox}>
          <Icon type={item.icon as TMenu} />
        </div>
        <div className={s.main}>
          <div className={cnMerge(s.title, s.fullTitle)}>{t(item.title)}</div>
          <div className={s.desc}>{item.desc || '--'}</div>
        </div>
      </button>
    )
  }

  return (
    <button type='button' className={s.wrapper} onClick={onClick}>
      <Icon type={item.icon as TMenu} />
      <div className={s.title}>{t(item.title)}</div>
    </button>
  )
}

export default Item
