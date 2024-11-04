import type { FC } from 'react'

import CheckSVG from '~/icons/CheckBold'

import useSalon from '../styles/header/status_ball'

type TProps = {
  done?: boolean
  doing?: boolean
}

const StatusBall: FC<TProps> = ({ done = false, doing = false }) => {
  const s = useSalon()

  if (done) {
    return (
      <div className={s.done}>
        <CheckSVG className={s.checkIcon} />
      </div>
    )
  }

  if (doing) {
    return (
      <div className={s.doing}>
        <div className={s.dot} />
      </div>
    )
  }

  return <div className={s.todo} />
}

export default StatusBall
