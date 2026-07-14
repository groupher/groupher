import type { CSSProperties } from 'react'

import type { TIconListOption } from '../spec'
import IconNode from './IconNode'
import useSalon from './salon/icon_list_item'

type TProps = {
  item: TIconListOption
  active: boolean
  activeColor?: string
  activeBg?: string
}

type TMarkerStyle = CSSProperties & {
  '--marker-active-color'?: string
}

export default function IconListItem({ item, active, activeColor, activeBg }: TProps) {
  const s = useSalon({ active, hasActiveColor: Boolean(activeColor) })
  const markerStyle: TMarkerStyle | undefined =
    activeColor || (active && activeBg)
      ? {
          ...(activeColor ? { '--marker-active-color': activeColor } : {}),
          ...(active && activeBg ? { backgroundColor: activeBg } : {}),
        }
      : undefined

  return (
    <span className={s.marker} style={markerStyle}>
      <IconNode item={item} iconClassName={s.icon} color={active ? activeColor : undefined} />
    </span>
  )
}
