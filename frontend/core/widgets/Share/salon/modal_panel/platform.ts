import useTwBelt from '~/hooks/useTwBelt'
import CodeSVG from '~/icons/Code'
import LinkSVG from '~/icons/Link'
import EmailSVG from '~/icons/Mail'
import DoubanSVG from '~/icons/social/Douban'
import FacebookSVG from '~/icons/social/Facebook'
import TelegramSVG from '~/icons/social/Telegram'
import TwitterSVG from '~/icons/social/Twitter'
import WeChatSVG from '~/icons/social/WeChat'
import WeiboSVG from '~/icons/social/Weibo'
import { SHARE_TYPE } from '../../constant'

export default function useSalon() {
  const { cn, fg, fill, cut, hover } = useTwBelt()

  return {
    wrapper: 'px-5 pb-4 w-full min-h-44 trans-all-200',
    header: 'row items-end mt-4 pl-6 mb-5',
    hint: cn('text-xs', fg('digest')),
    article: cn('text-sm mx-1', cut('w-44'), fg('title')),
    inner: 'row wrap',
    //
    media: cn('size-20 column-align-both', hover('bg')),
    logoBox: 'size-8 align-both',
    icon: cn('size-7', fill('digest'), hover('icon')),
    title: cn('text-xs mt-1', hover('fg')),
  }
}

export const Icon = {
  [SHARE_TYPE.LINKS]: LinkSVG,
  [SHARE_TYPE.EMBED]: CodeSVG,
  [SHARE_TYPE.WECHAT]: WeChatSVG,
  [SHARE_TYPE.TWITTER]: TwitterSVG,
  [SHARE_TYPE.EMAIL]: EmailSVG,
  [SHARE_TYPE.TELEGRAM]: TelegramSVG,
  [SHARE_TYPE.WEIBO]: WeiboSVG,
  [SHARE_TYPE.DOUBAN]: DoubanSVG,
  [SHARE_TYPE.FACEBOOK]: FacebookSVG,
}
