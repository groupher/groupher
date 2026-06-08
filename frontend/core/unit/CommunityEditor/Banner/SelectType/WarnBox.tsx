import type { FC } from 'react'

import useSalon from '../salon/select_type/warn_box'

type TProps = {
  title: string
  desc: string
}

const WarnBox: FC<TProps> = ({ title, desc }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <h3 className={s.title}>{title}</h3>
      <div className={s.desc}>{desc}</div>
    </div>
  )
}

export default WarnBox
