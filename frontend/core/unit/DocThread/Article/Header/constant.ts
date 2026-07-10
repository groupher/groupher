import BotSVG from '~/icons/Bot'
import ChatCircleTextSVG from '~/icons/ChatCircleText'
import DownloadSimpleSVG from '~/icons/DownloadSimple'
import FileImageSVG from '~/icons/FileImage'
import LinkSVG from '~/icons/Link'
import LinkOutsideSVG from '~/icons/LinkOutside'
import MarkdownSVG from '~/icons/Markdown'
import ShareNetworkSVG from '~/icons/ShareNetwork'
import LinkedInSVG from '~/icons/social/LinkedIn'
import WeChatSVG from '~/icons/social/WeChat'
import WeiboSVG from '~/icons/social/Weibo'

export const COPY_ACTIONS = [
  {
    key: 'link',
    title: 'Copy link',
    desc: 'Copy the current page URL',
    Icon: LinkSVG,
    external: false,
  },
  {
    key: 'markdown',
    title: 'Copy as Markdown',
    desc: 'Copy the .md version for AI context',
    Icon: MarkdownSVG,
    external: false,
  },
  {
    key: 'view-md',
    title: 'View as Markdown',
    desc: 'Open the plain Markdown page',
    Icon: LinkOutsideSVG,
    external: false,
  },
  {
    key: 'chatgpt',
    title: 'Open in ChatGPT',
    desc: 'Ask questions with this page as context',
    Icon: BotSVG,
    external: true,
  },
  {
    key: 'claude',
    title: 'Open in Claude',
    desc: 'Start an AI conversation from this doc',
    Icon: ChatCircleTextSVG,
    external: true,
  },
] as const

export const SHARE_ACTIONS = [
  { key: 'wechat', title: 'WeChat QR', desc: 'Share this page by QR code', Icon: WeChatSVG },
  {
    key: 'weibo',
    title: 'Share to Weibo',
    desc: 'Post this document link to Weibo',
    Icon: WeiboSVG,
  },
  {
    key: 'linkedin',
    title: 'Share to LinkedIn',
    desc: 'Share with your professional network',
    Icon: LinkedInSVG,
  },
  {
    key: 'image',
    title: 'Share image',
    desc: 'Create a wallpaper-style long image',
    Icon: FileImageSVG,
  },
  {
    key: 'download',
    title: 'Download image',
    desc: 'Save the generated social card',
    Icon: DownloadSimpleSVG,
  },
  {
    key: 'native',
    title: 'System share',
    desc: 'Use the browser or mobile share sheet',
    Icon: ShareNetworkSVG,
  },
] as const
