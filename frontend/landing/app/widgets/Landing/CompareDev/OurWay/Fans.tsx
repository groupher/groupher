import Img from '~/Img'
import { mockUsers } from '~/mock'
import Facepile from '~/widgets/Facepile/LandingPage'

import useSalon, { cn } from '../../salon/compare_dev/fans'

export default () => {
  const s = useSalon()
  const users = mockUsers(10)

  return (
    <>
      <div className={cn(s.userWrapper, s.borderOrange, 'bottom-32 right-40 opacity-65')}>
        <Img src={users[6].avatar} className={cn(s.avatar)} />
      </div>

      <div className={cn(s.userWrapper, s.borderGreen, 'bottom-24 right-80 opacity-80')}>
        <Img src={users[0].avatar} className={cn(s.avatar, 'size-6')} />
      </div>

      <div className={cn(s.commentsGroup, s.bounceAnimation, 'top-40 left-24 opacity-80')}>
        <Img src='icons/emotion/confused.png' className={cn(s.emoji, 'opacity-100')} />
        <Facepile users={users.slice(8, 10)} left={2} className='scale-90 gap-x-1 opacity-65' />
      </div>

      <div className={cn(s.commentsGroup, s.wingleAnimation, 'bottom-20 left-14 ml-10')}>
        <Img src='icons/emotion/heart.png' className={cn(s.emoji, 'animate-pulse')} />
        <Facepile users={users.slice(2, 5)} left={2} className='scale-90 gap-x-1' />
      </div>

      <div className={cn(s.commentsGroup, s.wingleAnimation, 'top-40 right-52 animate-delay-500')}>
        <Img src='icons/emotion/beer.png' className={s.emoji} />
        <Facepile users={users.slice(3, 6)} left={2} className='scale-90 gap-x-1' />
      </div>
    </>
  )
}
