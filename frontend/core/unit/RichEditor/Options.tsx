import { type FC, memo, type ReactNode } from 'react'

import Menu from './Menu'
import useSalon from './salon/options'

type TProps = {
  addon: ReactNode
}

const Options: FC<TProps> = ({ addon }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {addon}
      <div className='grow' />
      <Menu />
    </div>
  )
}

export default memo(Options)
