import type { FC } from 'react'

import SidebarIcon from '~/icons/dsb/Sidebar'

import { DOC_PUBLIC_TREE_LABEL } from '../constant'
import useSalon from './salon/side_tree_toggle'

type TProps = {
  onToggle: () => void
}

const SideTreeToggle: FC<TProps> = ({ onToggle }) => {
  const s = useSalon()

  return (
    <button
      type='button'
      className={s.button}
      aria-label={DOC_PUBLIC_TREE_LABEL.hideTree}
      title={DOC_PUBLIC_TREE_LABEL.hideTree}
      onClick={onToggle}
    >
      <SidebarIcon className={s.icon} />
    </button>
  )
}

export default SideTreeToggle
