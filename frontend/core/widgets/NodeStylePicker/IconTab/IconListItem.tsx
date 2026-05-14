import { NODE_STYLE } from '~/const/node_style'
import type { TNodeStyleValue } from '~/spec'

import type { TIconOption } from '../spec'
import IconNode from './IconNode'
import useSalon from './salon/icon_list_item'

type TProps = {
  item: TIconOption
  active: boolean
}

export const isSelectedIcon = (selectedValue: TNodeStyleValue, item: TIconOption): boolean =>
  selectedValue.type === NODE_STYLE.ICON &&
  selectedValue.provider === item.provider &&
  selectedValue.name === item.name

export default function IconListItem({ item, active }: TProps) {
  const s = useSalon({ active })

  return <IconNode item={item} iconClassName={s.icon} />
}
