import type { FC } from 'react'

import PlusSVG from '~/icons/Plus'

import useSalon from './salon/add_section_menu'

type TProps = {
  onAddGroup: () => void
}

const AddSectionMenu: FC<TProps> = ({ onAddGroup }) => {
  const s = useSalon()

  return (
    <button type='button' className={s.trigger} onClick={onAddGroup}>
      <PlusSVG className={s.plusIcon} />
      Add group
    </button>
  )
}

export default AddSectionMenu
