import { SHARE_TYPE } from '../../constant'

import LinkSVG from '~/icons/Link'
import EmailSVG from '~/icons/Mail'
import TwitterSVG from '~/icons/social/Twitter'
import WeChatSVG from '~/icons/social/WeChat'
import WeiboSVG from '~/icons/social/Weibo'
import TelegramSVG from '~/icons/social/Telegram'
import DoubanSVG from '~/icons/social/Douban'
import FacebookSVG from '~/icons/social/Facebook'
import CodeSVG from '~/icons/Code'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill, cut, hoverable } = useTwBelt()

  return {
    wrapper: cn('px-5 pb-4 w-full min-h-44 trans-all-200'),
    header: 'row items-end mt-4 pl-6 mb-5',
    hint: cn('text-xs', fg('text.digest')),
    article: cn('text-sm mx-1', cut('w-44'), fg('text.title')),
    inner: 'row wrap',
    //
    media: cn('size-20 column-align-both', hoverable('bg')),
    logoBox: 'size-8 align-both',
    icon: cn('size-7', fill('text.digest'), hoverable('icon')),
    title: cn('text-xs mt-1', hoverable('fg')),
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
