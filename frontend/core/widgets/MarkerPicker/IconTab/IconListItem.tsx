import type { TColorName } from '~/spec'

import type { TIconListOption } from '../spec'
import IconNode from './IconNode'
import useSalon from './salon/icon_list_item'

type TProps = {
  item: TIconListOption
  active: boolean
  color?: TColorName
}

export default function IconListItem({ item, active, color }: TProps) {
  const s = useSalon({ active, color })

  return <IconNode item={item} iconClassName={s.icon} />
}
