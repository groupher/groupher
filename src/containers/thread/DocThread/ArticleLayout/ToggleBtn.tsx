import { type FC, memo } from 'react'

import ArrowSVG from '~/icons/ArrowSimple'
import ListSVG from '~/icons/List'

import useSalon from '../salon/article_layout/toggle_btn'

type TProps = {
  open: boolean
  onToggle: (toggle: boolean) => void
}

const ToggleBtn: FC<TProps> = ({ open, onToggle }) => {
  const s = useSalon({ open })

  return (
    <div className={s.wrapper} onClick={() => onToggle(!open)}>
      {open ? <ArrowSVG className={s.arrowIcon} /> : <ListSVG className={s.listIcon} />}
    </div>
  )
}

export default memo(ToggleBtn)
