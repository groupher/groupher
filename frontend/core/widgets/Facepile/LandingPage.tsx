import type { FC } from 'react'

import Img from '~/Img'
import type { TSpace, TUser } from '~/spec'

import useSalon, { cn } from './salon/landing_page'

type TProps = {
  users: TUser[]
  className?: string
  circle?: boolean
} & TSpace

const LandingPage: FC<TProps> = ({ users, circle = false, className = '', ...spacing }) => {
  const s = useSalon({ circle, ...spacing })

  return (
    <div className={cn(s.wrapper, className)}>
      {users.map((user) => (
        <Img key={user.login} src={user.avatar} className={s.avatar} />
      ))}
    </div>
  )
}

export default LandingPage
