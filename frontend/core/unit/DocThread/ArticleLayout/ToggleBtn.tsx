import { type FC, memo } from 'react'

import { cnMerge } from '~/css'
import ArrowSVG from '~/icons/ArrowSimple'
import ListSVG from '~/icons/List'

import useSalon from './salon/toggle_btn'

type TProps = {
  open: boolean
  onToggle: (toggle: boolean) => void
  className?: string
}

const ToggleBtn: FC<TProps> = ({ open, onToggle, className = '' }) => {
  const s = useSalon({ open })

  return (
    <button type='button' className={cnMerge(s.wrapper, className)} onClick={() => onToggle(!open)}>
      {open ? <ArrowSVG className={s.arrowIcon} /> : <ListSVG className={s.listIcon} />}
    </button>
  )
}

export default memo(ToggleBtn)
