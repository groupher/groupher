import { SOCIAL_LIST } from '~/const/social'
import useTwBelt from '~/hooks/useTwBelt'
import BiliBiliSVG from '~/icons/social/BiliBili'
import BossSVG from '~/icons/social/Boss'
import EmailSVG from '~/icons/social/Email'
import GithubSVG from '~/icons/social/Github'
import TikTokSVG from '~/icons/social/TikTok'
import TwitterSVG from '~/icons/social/Twitter'
import WeChatSVG from '~/icons/social/WeChat'
import WeiboSVG from '~/icons/social/Weibo'
import ZhihuSVG from '~/icons/social/Zhihu'
// import LagouSVG from '~/icons/social/Lagou'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, margin, hover } = useTwBelt()

  return {
    wrapper: cn('row-center gap-3.5', margin(spacing)),
    socialBox: cn('align-both size-5', hover('bg')),
    icon: cn('size-4', hover('icon')),
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
