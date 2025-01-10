import type { FC } from 'react'

import useSalon from '../styles/list/date_divider'

type TProps = {
  text: string | null
}

const DateDivider: FC<TProps> = ({ text }) => {
  const s = useSalon()

  if (!text) return null

  return (
    <div className={s.wrapper}>
      <div className={s.slashSign}>&#47;&#47;</div> <div className={s.dateText}>{text}</div>
    </div>
  )
}

export default DateDivider
