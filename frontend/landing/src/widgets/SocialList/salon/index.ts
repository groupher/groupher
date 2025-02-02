import type { TSpace } from '~/spec'
import { SOCIAL_LIST } from '~/const/social'

import TikTokSVG from '~/widgets/Icons/social/TikTok'
import EmailSVG from '~/icons/social/Email'
import WeChatSVG from '~/icons/social/WeChat'
import TwitterSVG from '~/icons/social/Twitter'
import WeiboSVG from '~/icons/social/Weibo'
import ZhihuSVG from '~/icons/social/Zhihu'
import GithubSVG from '~/icons/social/Github'
import BiliBiliSVG from '~/icons/social/BiliBili'
import BossSVG from '~/icons/social/Boss'
// import LagouSVG from '~/icons/social/Lagou'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, hoverable } = useTwBelt()

  return {
    wrapper: cn('gap-3.5', margin(spacing)),
    socialBox: cn('align-both size-5', hoverable('bg')),
    icon: cn('size-4', hoverable('icon')),
  }
}

export const Icon = {
  [SOCIAL_LIST.TIKTOK]: TikTokSVG,
  [SOCIAL_LIST.EMAIL]: EmailSVG,
  [SOCIAL_LIST.TWITTER]: TwitterSVG,
  [SOCIAL_LIST.ZHIHU]: ZhihuSVG,
  [SOCIAL_LIST.GITHUB]: GithubSVG,
  [SOCIAL_LIST.BILIBILI]: BiliBiliSVG,
  [SOCIAL_LIST.WECHAT]: WeChatSVG,
  [SOCIAL_LIST.BOSS]: BossSVG,
  [SOCIAL_LIST.WEIBO]: WeiboSVG,
}
