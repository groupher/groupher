/*
 *
 * MasonryCards
 *
 */

import { type FC, memo, type ReactNode } from 'react'
import Masonry from 'react-masonry-css'

type TProps = {
  testid?: string
  column?: number
  children: ReactNode
}

const MasonryCards: FC<TProps> = ({ testid: _testid = 'masonry-cards', column = 2, children }) => {
  return (
    <Masonry
      breakpointCols={column}
      className='masonry-cards-grid'
      columnClassName='masonry-cards-grid_column'
    >
      {children}
    </Masonry>
  )
}

export default memo(MasonryCards)
