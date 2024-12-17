import type { FC } from 'react'

import useLogic from '../useLogic'
import useSalon from '../styles/header/close_line'

type TProps = {
  curve: boolean
}

const CloseLine: FC<TProps> = ({ curve }) => {
  const { closeDrawer } = useLogic()
  const s = useSalon()

  return (
    <div className={s.wrapper} onClick={() => closeDrawer()}>
      <div>todo</div>
    </div>
  )
}

export default CloseLine
