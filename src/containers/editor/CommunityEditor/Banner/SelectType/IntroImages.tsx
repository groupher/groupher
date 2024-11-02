import Image from 'next/image'

import type { TCommunityType } from '../../spec'
import { COMMUNITY_TYPE } from '../../constant'

import useSalon, { cn } from '../../styles/banner/select_type/intro_images'

type TProps = {
  type: TCommunityType
  current: TCommunityType
}

export default ({ type, current }: TProps) => {
  const s = useSalon()

  if (type === COMMUNITY_TYPE.WEB) {
    return (
      <div className={cn(s.wrapper, current === type && s.active)}>
        <div className={cn(s.cinemaImage, 'w-28')}>
          <Image
            src="/landing/apply/cinema4d.webp"
            width={200}
            height={200}
            className={cn(s.image, 'opacity-80')}
            alt="demo"
          />
        </div>

        <div className={s.codeImage}>
          <Image
            src="/landing/apply/code.png"
            width={200}
            height={200}
            className={cn(s.image, 'opacity-65')}
            alt="demo"
          />
        </div>

        <div className={s.adminsImage}>
          <Image
            src="/landing/apply/admins.png"
            width={200}
            height={200}
            className={cn(s.image, 'opacity-65')}
            alt="demo"
          />
        </div>
      </div>
    )
  }

  if (type === COMMUNITY_TYPE.GAME) {
    return (
      <div className={cn(s.wrapper, current === type && s.active)}>
        <div className={cn(s.gameBar, 'bottom-24 left-3 opacity-40 rotate-3')} />
        <div className={cn(s.gameBar, 'bottom-10 right-2 saturate-0 opacity-30 -rotate-2')} />

        <div className={cn(s.gameBox, 'bottom-3 left-4 rotate-12')}>
          <Image
            src="/landing/apply/game-controller.png"
            width={200}
            height={200}
            className={cn(s.gameImage, 'opacity-65')}
            alt="demo"
          />
        </div>

        <div className={cn(s.gameBox, 'right-4 h-32 w-20')}>
          <Image
            src="/landing/apply/game-man.png"
            width={240}
            height={500}
            className={cn(s.gameImage, 'opacity-65')}
            alt="demo"
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn(s.wrapper, current === type && s.active)}>
      <div className={cn(s.cinemaImage, 'w-28')}>
        <Image
          src="/landing/apply/cinema4d.webp"
          width={200}
          height={200}
          className={cn(s.image, 'opacity-80')}
          alt="demo"
        />
      </div>

      <div className={s.codeImage}>
        <Image
          src="/landing/apply/code.png"
          width={200}
          height={200}
          className={cn(s.image, 'opacity-65')}
          alt="demo"
        />
      </div>

      <div className={s.adminsImage}>
        <Image
          src="/landing/apply/admins.png"
          width={200}
          height={200}
          className={cn(s.image, 'opacity-65')}
          alt="demo"
        />
      </div>
    </div>
  )
}
