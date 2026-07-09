import type { FC } from 'react'

import ListChevronsDownUpSVG from '~/icons/ListChevronsDownUp'
import ListChevronsUpDownSVG from '~/icons/ListChevronsUpDown'

import { DOC_PUBLIC_TREE_LABEL } from '../constant'
import useSalon from './salon/group_toggle'

type TProps = {
  collapsed: boolean
  onToggle: () => void
}

const GroupToggle: FC<TProps> = ({ collapsed, onToggle }) => {
  const s = useSalon()
  const ToggleIcon = collapsed ? ListChevronsUpDownSVG : ListChevronsDownUpSVG
  const label = collapsed
    ? DOC_PUBLIC_TREE_LABEL.expandGroups
    : DOC_PUBLIC_TREE_LABEL.collapseGroups

  return (
    <button type='button' className={s.button} aria-label={label} title={label} onClick={onToggle}>
      <ToggleIcon className={s.icon} />
    </button>
  )
}

export default GroupToggle
