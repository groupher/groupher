import type { FC } from 'react'

import List from './List'

import type { TProps as TTagProps } from '.'

import useSalon from './salon'

type TProps = Omit<TTagProps, 'withSetter' | 'community' | 'thread'>

const FoldList: FC<TProps> = ({ items, max, size, ...spacing }) => {
  const s = useSalon(spacing)

  return (
    <div className={s.foldWrapper}>
      <List items={items} size={size} max={max} withTitle={false} {...spacing} />
      <div className={s.more}>&nbsp;+{items.length}</div>
    </div>
  )
}

export default FoldList
