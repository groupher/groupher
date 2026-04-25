/*
 *
 * TagNode
 *
 */

import type { FC } from 'react'
import useLayout from '~/hooks/useLayout'
import type { TColorName } from '~/spec'
// import useTheme from '~/hooks/useTheme'

import { TAG_LAYOUT } from '~/const/layout'
// import THEME from '~/const/theme'

import HashSVG from '~/icons/HashTag'
import HashSVGBold from '~/icons/HashTagBold'

import useSalon from './salon'

export type TProps = {
  color?: TColorName
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

  return tagLayout === TAG_LAYOUT.DOT ? <div className={s.dot} /> : <HashIcon className={s.hash} />
}

export default TagNode
