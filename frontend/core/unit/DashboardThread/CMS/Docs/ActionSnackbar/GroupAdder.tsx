import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import FolderPlusSVG from '~/icons/FolderPlus'

import useDocsEditor from '../Editor/store/hooks'
import { TREE_ACTION_LABEL_KEY } from './constant'
import useSalon from './salon/group_adder'

const GroupAdder: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const { addGroup } = useDocsEditor()
  const label = t(TREE_ACTION_LABEL_KEY.GROUP)

  return (
    <button type='button' className={s.button} aria-label={label} title={label} onClick={addGroup}>
      <FolderPlusSVG className={s.icon} />
      <span className={s.text}>{label}</span>
    </button>
  )
}

export default GroupAdder
