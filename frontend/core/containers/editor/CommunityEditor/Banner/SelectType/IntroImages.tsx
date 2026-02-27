import Image from 'next/image'
import APP from '~/const/app'
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

type TAvatarProps = {
  index: number
  className: string
  highlight?: boolean
}

export default ({ type, current }: TProps) => {
  const s = useSalon()

  const users = mockUsers(6)
  const Avatar = ({ index, className, highlight = false }: TAvatarProps) => (
    <Image
      src={users[index].avatar}
      width={40}
      height={40}
      className={cn(s.avatar, highlight && s.avatarHighlight, className)}
      alt='avatar'
      unoptimized
    />
  )

  if (type === COMMUNITY_TYPE.PRODUCT) {
    return (
      <div className={cn(s.wrapper, current === type && s.active)}>
        <div className={cn(s.cinemaImage, 'w-28')}>
          <Image
            src={`/${APP.LANDING}/apply/cinema4d.webp`}
            width={200}
            height={200}
            className={cn(s.image, 'opacity-80')}
            alt='demo'
          />
        </div>

        <div className={s.codeImage}>
          <Image
            src={`/${APP.LANDING}/apply/code.png`}
            width={200}
            height={200}
            className={cn(s.image, 'opacity-65')}
            alt='demo'
          />
        </div>

        <div className={s.adminsImage}>
          <Image
            src={`/${APP.LANDING}/apply/admins.png`}
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
            src={`/${APP.LANDING}/apply/game-controller.png`}
            width={200}
            height={200}
            className={cn(s.gameImage, 'opacity-65')}
            alt='demo'
          />
        </div>

        <div className={cn(s.gameBox, 'right-4 h-32 w-20')}>
          <Image
            src={`/${APP.LANDING}/apply/game-man.png`}
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
            src={`/${APP.LANDING}/apply/blackboard.png`}
            width={200}
            height={200}
            className={cn(s.image, 'opacity-80')}
            alt='demo'
          />
        </div>

        <div className={cn(s.chartImage, 'w-28')}>
          <Image
            src={`/${APP.LANDING}/apply/chart.png`}
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

          <Avatar index={0} className='top-2 left-0' />
          <Avatar index={1} className='top-4 -right-2' />
          <Avatar index={2} className='top-9 left-2' />
          <Avatar index={3} className='top-12 -left-3' />
          <Avatar index={3} className='top-14 -right-3' />
          <Avatar index={4} className='-top-3 -right-2' />

          <ArtSVG className={s.pillIcon} />
        </div>
        <div className={cn(s.pill, s.pillNormal)}>
          {current === type && <div className={s.pillGadient2} />}

          <Avatar index={0} className='top-2 left-0' />
          <Avatar index={1} className='top-4 -right-2' />
          <Avatar index={2} className='top-9 left-2' />
          <Avatar index={3} className='top-12 -left-3' />
          <Avatar index={3} className='top-14 -right-3' />
          <Avatar index={4} className='-top-3 -right-2' />

          <RocketSVG className={s.pillIcon} />
        </div>
        <div className={cn(s.pill, s.pillHighlight)}>
          <div className={s.pillGadient} />
          <Avatar index={0} className='top-2 left-0' highlight />
          <Avatar index={1} className='top-4 -right-2' highlight />
          <Avatar index={2} className='top-9 left-2' highlight />
          <Avatar index={3} className='top-12 -left-3' highlight />
          <Avatar index={3} className='top-14 -right-3' highlight />
          <Avatar index={4} className='-top-3 -right-2' highlight />

          <UniverseSVG className={cn(s.pillIcon, s.pillHighlighIcon)} />
        </div>
        <div className={cn(s.pill, s.pillNormal)}>
          {current === type && <div className={s.pillGadient4} />}
          <Avatar index={0} className='top-2 left-0' />
          <Avatar index={1} className='top-4 -right-2' />
          <Avatar index={2} className='top-9 left-2' />
          <Avatar index={3} className='top-12 -left-3' />
          <Avatar index={3} className='top-14 -right-3' />
          <Avatar index={4} className='-top-3 -right-2' />

          <MusicSVG className={s.pillIcon} />
        </div>
      </div>
    </div>
  )
}
