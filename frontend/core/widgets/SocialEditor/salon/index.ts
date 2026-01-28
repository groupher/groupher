import { SOCIAL_LIST } from '~/const/social'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import BiliBiliSVG from '~/icons/social/BiliBili'
import BossSVG from '~/icons/social/Boss'
import EmailSVG from '~/icons/social/Email'
import GithubSVG from '~/icons/social/Github'
import TikTokSVG from '~/icons/social/TikTok'
import WeChatSVG from '~/icons/social/WeChat'
import WeiboSVG from '~/icons/social/Weibo'
import ZhihuSVG from '~/icons/social/Zhihu'
import TwitterSVG from '~/icons/TwitterX'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {
  width: string
} & TSpace

export default ({ width, ...spacing }: TProps) => {
  const { isLightTheme } = useTheme()
  const { cn, margin, fg, br, bg, shadow, fill, primary } = useTwBelt()

  return {
    wrapper: cn('mb-7', width, margin(spacing)),
    platforms: cn(
      'row-center wrap mt-4 mb-6 px-2 py-1.5 gap-x-3 gap-y-1.5 rounded-md w-full border',
      br('divider'),
    ),
    label: cn('text-sm mb-3', fg('title')),
    hint: cn('text-xs leading-relaxed', fg('digest')),
    inputWrapper: cn('column gap-y-4'),
    iconBox: cn('align-both relative size-5 pointer rounded'),
    iconActiveBar: cn(
      'absolute -bottom-2.5 size-1.5 circle',
      isLightTheme && 'opacity-65',
      primary('bg'),
    ),
    iconBoxActive: cn(bg('hoverBg'), shadow('md')),
    icon: cn('size-4 saturate-0 hover:saturate-100 hover:scale-110 trans-all-100', fill('digest')),
    iconActive: cn('saturate-100'),
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
  // [SOCIAL_LIST.LAGOU]: LagouSVG, 14,
  [SOCIAL_LIST.WEIBO]: WeiboSVG,
}
