/*
 * TabBar
 */

import { type FC, memo } from 'react'

import type { TSizeSM, TThread } from '~/spec'
import SIZE from '~/const/size'
import { THREAD } from '~/const/thread'
import { ANCHOR } from '~/const/dom'

import { sortByIndex } from '~/helper'

import NormalView from './NormalView'

import type { TTabItem } from './spec'

export type TProps = {
  source: TTabItem[]
  active: string
  size?: TSizeSM
  withIcon?: boolean
  onChange?: (thread: TThread) => void
}

const TabBar: FC<TProps> = ({
  source,
  active = THREAD.POST,
  onChange = console.log,
  size = SIZE.MEDIUM,
  withIcon = false,
}) => {
  const sortedSource = sortByIndex(source)

  return (
    <div id={ANCHOR.GLOBAL_TABBER_ID}>
      <NormalView
        source={sortedSource}
        active={active}
        onChange={onChange}
        size={size}
        withIcon={withIcon}
      />
    </div>
  )
}

export default memo(TabBar)
