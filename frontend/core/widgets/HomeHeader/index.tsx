import type { MotionValue } from 'motion/react'
import type { FC } from 'react'

import NormalHeader from './NormalHeader'
import StickyHeader from './StickyHeader'

type TProps = {
  sticky?: boolean
  maxWidth?: string | MotionValue<string>
}

const HomeHeader: FC<TProps> = ({ sticky = false, maxWidth = '100%' }) => {
  if (sticky) return <StickyHeader maxWidth={maxWidth} />

  return <NormalHeader />
}

export default HomeHeader
