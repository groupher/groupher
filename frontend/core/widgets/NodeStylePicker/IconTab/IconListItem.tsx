import { NODE_STYLE } from '~/const/node_style'
import type { TNodeStyleValue } from '~/spec'

import type { TDevLogoOption, TIconListOption, TIconOption } from '../spec'
import IconNode from './IconNode'
import useSalon from './salon/icon_list_item'

type TProps = {
  item: TIconListOption
  active: boolean
}

export const isSelectedIcon = (selectedValue: TNodeStyleValue, item: TIconOption): boolean =>
  selectedValue.type === NODE_STYLE.ICON &&
  selectedValue.provider === item.provider &&
  selectedValue.name === item.name

const isDevLogoOption = (item: TIconListOption): item is TDevLogoOption => item.kind === 'dev'

const isSelectedDevLogo = (selectedValue: TNodeStyleValue, item: TIconListOption): boolean =>
  isDevLogoOption(item) && selectedValue.type === NODE_STYLE.DEV && selectedValue.name === item.name

export const isSelectedIconOption = (
  selectedValue: TNodeStyleValue,
  item: TIconListOption,
): boolean => {
  if (isDevLogoOption(item)) return isSelectedDevLogo(selectedValue, item)

  return isSelectedIcon(selectedValue, item)
}

export default function IconListItem({ item, active }: TProps) {
  const s = useSalon({ active })

  return <IconNode item={item} iconClassName={s.icon} />
}
