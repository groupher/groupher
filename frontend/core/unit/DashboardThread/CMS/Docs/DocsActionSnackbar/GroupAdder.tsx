import type { FC } from 'react'

import FolderPlusSVG from '~/icons/FolderPlus'

import { TREE_ACTION } from './constant'
import useSalon from './salon/group_adder'

const GroupAdder: FC = () => {
  const s = useSalon()

  return (
    <button
      type='button'
      className={s.button}
      aria-label={TREE_ACTION.GROUP}
      title={TREE_ACTION.GROUP}
    >
      <FolderPlusSVG className={s.icon} />
      <span className={s.text}>{TREE_ACTION.GROUP}</span>
    </button>
  )
}

export default GroupAdder
