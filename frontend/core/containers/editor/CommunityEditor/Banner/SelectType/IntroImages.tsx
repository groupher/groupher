import Image from 'next/image'
import ArtSVG from '~/icons/Art'
import MusicSVG from '~/icons/Music'
import RocketSVG from '~/icons/Rocket'
import UniverseSVG from '~/icons/Universe'
import { mockUsers } from '~/mock'
import Facepile from '~/widgets/Facepile/LandingPage'
import { COMMUNITY_TYPE } from '../../constant'
import useSalon, { cn } from '../../salon/banner/select_type/intro_images'
import type { TCommunityType } from '../../spec'

type TProps = {
  type: TCommunityType
  current: TCommunityType
}

export default ({ type, current }: TProps) => {
  const s = useSalon()

  const users = mockUsers(6)

  if (type === COMMUNITY_TYPE.PRODUCT) {
    return (
      <div className={cn(s.wrapper, current === type && s.active)}>
        <div className={cn(s.cinemaImage, 'w-28')}>
          <Image
            src='/landing/apply/cinema4d.webp'
            width={200}
            height={200}
            className={cn(s.image, 'opacity-80')}
            alt='demo'
          />
        </div>

        <div className={s.codeImage}>
          <Image
            src='/landing/apply/code.png'
            width={200}
            height={200}
            className={cn(s.image, 'opacity-65')}
            alt='demo'
          />
        </div>

        <div className={s.adminsImage}>
          <Image
            src='/landing/apply/admins.png'
            width={200}
            height={200}
            className={cn(s.image, 'opacity-65')}
            alt='demo'
          />
        </div>
      </div>
    )
  }

  if (type === COMMUNITY_TYPE.GAMING) {
    return (
      <div className={cn(s.wrapper, current === type && s.active)}>
        <div className={cn(s.gameBar, 'bottom-24 left-3 opacity-40 rotate-3')} />
        <div className={cn(s.gameBar, 'bottom-10 right-2 saturate-0 opacity-30 -rotate-2')} />

        <div className={cn(s.gameBox, 'bottom-3 left-4 rotate-12')}>
          <Image
            src='/landing/apply/game-controller.png'
            width={200}
            height={200}
            className={cn(s.gameImage, 'opacity-65')}
            alt='demo'
          />
        </div>

        <div className={cn(s.gameBox, 'right-4 h-32 w-20')}>
          <Image
            src='/landing/apply/game-man.png'
            width={240}
            height={500}
            className={cn(s.gameImage, 'opacity-65')}
            alt='demo'
          />
        </div>
      </div>
    )
  }

  if (type === COMMUNITY_TYPE.TEACH) {
    return (
      <div className={cn(s.wrapper, current === type && s.active)}>
        <div className={cn(s.teachImage, 'w-28')}>
          <Image
            src='/landing/apply/blackboard.png'
            width={200}
            height={200}
            className={cn(s.image, 'opacity-80')}
            alt='demo'
          />
        </div>

        <div className={cn(s.chartImage, 'w-28')}>
          <Image
            src='/landing/apply/chart.png'
            width={200}
            height={200}
            className={cn(s.image, 'opacity-80')}
            alt='demo'
          />
        </div>
        <div className={s.users}>
          <Facepile users={users} className='gap-x-1' circle />
        </div>
      </div>
    )
  }

  return (
    <div className={cn(s.wrapper, current === type && s.active)}>
      <div className={s.pillsWrapper}>
        <div className={cn(s.pill, s.pillNormal)}>
          {current === type && <div className={s.pillGadient3} />}

          <img src={users[0].avatar} className={cn(s.avatar, 'top-2 left-0')} alt='avatar' />
          <img src={users[1].avatar} className={cn(s.avatar, 'top-4 -right-2')} alt='avatar' />
          <img src={users[2].avatar} className={cn(s.avatar, 'top-9 left-2')} alt='avatar' />
          <img src={users[3].avatar} className={cn(s.avatar, 'top-12 -left-3')} alt='avatar' />
          <img src={users[3].avatar} className={cn(s.avatar, 'top-14 -right-3')} alt='avatar' />
          <img src={users[4].avatar} className={cn(s.avatar, '-top-3 -right-2')} alt='avatar' />

          <ArtSVG className={s.pillIcon} />
        </div>
        <div className={cn(s.pill, s.pillNormal)}>
          {current === type && <div className={s.pillGadient2} />}

          <img src={users[0].avatar} className={cn(s.avatar, 'top-2 left-0')} alt='avatar' />
          <img src={users[1].avatar} className={cn(s.avatar, 'top-4 -right-2')} alt='avatar' />
          <img src={users[2].avatar} className={cn(s.avatar, 'top-9 left-2')} alt='avatar' />
          <img src={users[3].avatar} className={cn(s.avatar, 'top-12 -left-3')} alt='avatar' />
          <img src={users[3].avatar} className={cn(s.avatar, 'top-14 -right-3')} alt='avatar' />
          <img src={users[4].avatar} className={cn(s.avatar, '-top-3 -right-2')} alt='avatar' />

          <RocketSVG className={s.pillIcon} />
        </div>
        <div className={cn(s.pill, s.pillHighlight)}>
          <div className={s.pillGadient} />
          <img
            src={users[0].avatar}
            className={cn(s.avatar, s.avatarHighlight, 'top-2 left-0')}
            alt='avatar'
          />
          <img
            src={users[1].avatar}
            className={cn(s.avatar, s.avatarHighlight, 'top-4 -right-2')}
            alt='avatar'
          />
          <img
            src={users[2].avatar}
            className={cn(s.avatar, s.avatarHighlight, 'top-9 left-2')}
            alt='avatar'
          />
          <img
            src={users[3].avatar}
            className={cn(s.avatar, s.avatarHighlight, 'top-12 -left-3')}
            alt='avatar'
          />
          <img
            src={users[3].avatar}
            className={cn(s.avatar, s.avatarHighlight, 'top-14 -right-3')}
            alt='avatar'
          />
          <img
            src={users[4].avatar}
            className={cn(s.avatar, s.avatarHighlight, '-top-3 -right-2')}
            alt='avatar'
          />

          <UniverseSVG className={cn(s.pillIcon, s.pillHighlighIcon)} />
        </div>
        <div className={cn(s.pill, s.pillNormal)}>
          {current === type && <div className={s.pillGadient4} />}
          <img src={users[0].avatar} className={cn(s.avatar, 'top-2 left-0')} alt='avatar' />
          <img src={users[1].avatar} className={cn(s.avatar, 'top-4 -right-2')} alt='avatar' />
          <img src={users[2].avatar} className={cn(s.avatar, 'top-9 left-2')} alt='avatar' />
          <img src={users[3].avatar} className={cn(s.avatar, 'top-12 -left-3')} alt='avatar' />
          <img src={users[3].avatar} className={cn(s.avatar, 'top-14 -right-3')} alt='avatar' />
          <img src={users[4].avatar} className={cn(s.avatar, '-top-3 -right-2')} alt='avatar' />

          <MusicSVG className={s.pillIcon} />
        </div>
      </div>
    </div>
  )
}
