import { MARKER } from '~/const/marker'
import type { TColorName, TMarkerValue } from '~/spec'

import type { TDevLogoOption, TIconListOption, TIconOption } from '../spec'
import IconNode from './IconNode'
import useSalon from './salon/icon_list_item'

type TProps = {
  item: TIconListOption
  active: boolean
  color?: TColorName
}

export const isSelectedIcon = (selectedValue: TMarkerValue, item: TIconOption): boolean =>
  selectedValue.type === MARKER.ICON &&
  selectedValue.provider === item.provider &&
  selectedValue.name === item.name

const isDevLogoOption = (item: TIconListOption): item is TDevLogoOption => item.kind === 'dev'

const isSelectedDevLogo = (selectedValue: TMarkerValue, item: TIconListOption): boolean =>
  isDevLogoOption(item) &&
  selectedValue.type === MARKER.ICON &&
  selectedValue.provider === 'dev' &&
  selectedValue.name === item.name

export const isSelectedIconOption = (
  selectedValue: TMarkerValue,
  item: TIconListOption,
): boolean => {
  if (isDevLogoOption(item)) return isSelectedDevLogo(selectedValue, item)

  return isSelectedIcon(selectedValue, item)
}

export default function IconListItem({ item, active, color }: TProps) {
  const s = useSalon({ active, color })

  return <IconNode item={item} iconClassName={s.icon} />
}
