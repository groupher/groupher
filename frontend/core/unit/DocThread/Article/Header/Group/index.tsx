import { usePathname } from 'next/navigation'
import type { FC } from 'react'

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

  const currentGroup: TDocPublicTreeGroup | null = findCurrentGroup(tree.groups, doc, pathname)

  return <div className={s.title}>{currentGroup?.title || 'Untitled'}</div>
}

export default Group
