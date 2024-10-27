import { mockUsers } from '~/mock'

import Facepile from '~/widgets/Facepile/LandingPage'
import Img from '~/Img'

import useSalon, { cn } from '../../salon/compare_dev/fans'

export default () => {
  const s = useSalon()
  const users = mockUsers(10)

  return (
    <div className={s.wrapper}>
      <div className={cn(s.userWrapper, s.borderOrange, 'top-24 right-80 mr-28 mt-1')}>
        <Img src={users[3].avatar} className={cn(s.avatar)} />
      </div>

      <div className={cn(s.userWrapper, s.borderPurple, 'top-24 left-60 ml-10')}>
        <Img src={users[6].avatar} className={cn(s.avatar, 'size-7')} />
      </div>

      <div className={cn(s.userWrapper, s.borderOrange, 'bottom-32 right-40 opacity-65')}>
        <Img src={users[6].avatar} className={cn(s.avatar)} />
      </div>

      <div className={cn(s.userWrapper, s.borderGreen, 'bottom-24 right-80 opacity-80')}>
        <Img src={users[0].avatar} className={cn(s.avatar, 'size-6')} />
      </div>

      <div className={cn(s.commentsGroup, 'top-40 left-24')}>
        <Img src="icons/emotion/confused.png" className={s.emoji} />
        <Facepile users={users.slice(8, 10)} left={2} className="scale-90 gap-x-1" />
      </div>

      <div className={cn(s.avatarGroup, 'bottom-40 left-64 ml-1')}>
        <Facepile users={users.slice(0, 2)} left={2} className="scale-90 gap-x-1" />
      </div>

      <div className={cn(s.commentsGroup, 'bottom-20 left-80 ml-10')}>
        <Img src="icons/emotion/heart.png" className={s.emoji} />
        <Facepile users={users.slice(2, 5)} left={2} className="scale-90 gap-x-1" />
      </div>

      <div className={cn(s.commentsGroup, 'top-40 right-64 mr-5 animate-delay-500')}>
        <Img src="icons/emotion/beer.png" className={s.emoji} />
        <Facepile users={users.slice(3, 6)} left={2} className="scale-90 gap-x-1" />
      </div>
    </div>
  )
}
