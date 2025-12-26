/*
 * TabBar
 */

import { type FC, memo } from 'react'
import { ANCHOR } from '~/const/dom'
import SIZE from '~/const/size'
import { THREAD } from '~/const/thread'
import { sortByIndex } from '~/helper'
import type { TSizeSM, TThread } from '~/spec'

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
  // @ts-expect-error
  const sortedSource = sortByIndex(source)

  return (
    <div id={ANCHOR.GLOBAL_TABBER_ID}>
      <NormalView
        // @ts-expect-error
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
