/*
 *
 * TagNode
 *
 */

import type { FC } from 'react'

import { TAG_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
// import useTheme from '~/hooks/useTheme'
import HashSVG from '~/icons/HashTag'
// import THEME from '~/const/theme'
import HashSVGBold from '~/icons/HashTagBold'
import type { TColorName, TMarkerValue } from '~/spec'
import MarkerRender from '~/widgets/MarkerRender'

import useSalon from './salon'

export type TProps = {
  color?: TColorName
  marker?: TMarkerValue | null
  iconSize?: number
  iconRight?: number | 'px'
  iconLeft?: number | 'px'
  iconTop?: number
  dotSize?: number
  dotRight?: number
  dotLeft?: number
  dotTop?: number
  hashSize?: number
  hashRight?: number | 'px'
  hashLeft?: number | 'px'
  hashTop?: number
  boldHash?: boolean
}

const TagNode: FC<TProps> = ({ boldHash = false, ...restProps }) => {
  const s = useSalon({ ...restProps })

  const { tagLayout } = useLayout()
  // const { theme } = useTheme()
  // const darkTheme = theme === THEME.DARK

  const HashIcon = boldHash ? HashSVGBold : HashSVG

  if (tagLayout === TAG_LAYOUT.ICON) {
    return (
      <span className={s.icon}>
        <MarkerRender
          value={restProps.marker ?? s.defaultIcon}
          size={restProps.iconSize ?? 3}
          color={restProps.color}
        />
      </span>
    )
  }

  return tagLayout === TAG_LAYOUT.DOT ? <div className={s.dot} /> : <HashIcon className={s.hash} />
}

export default TagNode
