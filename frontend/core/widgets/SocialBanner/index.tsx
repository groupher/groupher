import type { FC } from 'react'

import type { TSpace } from '~/spec'

import GithubSVG from '~/icons/Github8'
// import AppStoreSVG from '~/icons/AppStore'
import TwitterSVG from '~/icons/TwitterX'
import DiscordSVG from '~/icons/social/Discord'
import TikTokSVG from '~/icons/social/TikTok'
// import BiliBiliSVG from '~/icons/social/BiliBili'
import WeChatSVG from '~/icons/social/WeChat'
// import AppStoreSVG from '~/icons/social/AppStore'
// import LagouSVG from '~/icons/social/Lagou'

import useSalon, { cn } from './salon'

type TProps = TSpace

const SocialBanner: FC<TProps> = ({ ...spacing }) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={s.wrapper}>
      <div className={s.iconBox}>
        <GithubSVG className={s.icon} />
      </div>

      <div className={s.iconBox}>
        <TwitterSVG className={s.icon} />
      </div>

      <div className={s.iconBox}>
        <WeChatSVG className={s.icon} />
      </div>

      <div className={s.iconBox}>
        <DiscordSVG className={cn(s.icon, 'size-5')} />
      </div>

      <div className={s.iconBox}>
        <TikTokSVG className={s.icon} />
      </div>
      {/* <div className={s.iconBox}>
        <AppStoreSVG className={s.icon} />
      </div> */}
      {/* <div className={s.iconBox}>
        <BiliBiliSVG className={s.icon} />
      </div> */}
    </div>
  )
}

export default SocialBanner
