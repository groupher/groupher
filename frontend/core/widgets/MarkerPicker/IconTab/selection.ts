import { MARKER } from '~/const/marker'
import type { TMarkerValue } from '~/spec'

import type { TDevLogoOption, TIconListOption, TIconOption } from '../spec'

export const isDevLogoOption = (item: TIconListOption): item is TDevLogoOption =>
  item.type === 'dev'

export const isSelectedIcon = (selectedValue: TMarkerValue, item: TIconOption): boolean =>
  selectedValue.type === MARKER.ICON &&
  selectedValue.provider === item.provider &&
  selectedValue.name === item.name

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
