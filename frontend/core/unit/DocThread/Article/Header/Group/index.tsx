import type { FC } from 'react'

import { usePathname } from '~/platform'
import type { TDoc, TDocPublicTree, TDocPublicTreeGroup } from '~/spec'

import { findCurrentGroup } from '../helper'
import useSalon from './salon'

type TProps = {
  doc: TDoc
  tree: TDocPublicTree
}

const Group: FC<TProps> = ({ doc, tree }) => {
  const pathname = usePathname()
  const s = useSalon()

  const nodes = tree.tabs.flatMap((tab) => tab.groups)
  const currentGroup: TDocPublicTreeGroup | null = findCurrentGroup(nodes, doc, pathname)

  return <div className={s.title}>{currentGroup?.title || 'Untitled'}</div>
}

export default Group
