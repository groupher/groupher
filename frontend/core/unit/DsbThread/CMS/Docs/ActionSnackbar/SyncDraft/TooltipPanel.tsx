import type { FC } from 'react'

import { formatSavedTime } from './helper'
import useSalon from './salon/tooltip_panel'

type TProps = {
  updatedAt?: string | null
}

const TooltipPanel: FC<TProps> = ({ updatedAt }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>Draft saved</div>
      <div className={s.digest}>Last saved {formatSavedTime(updatedAt)}</div>
    </div>
  )
}

export default TooltipPanel
