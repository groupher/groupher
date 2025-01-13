import GithubSVG from '~/icons/social/Github'
import GoogleSVG from '~/icons/social/Google'
import FacebookSVG from '~/icons/social/Facebook'
import TwitterSVG from '~/icons/social/Twitter'
import DiscordSVG from '~/icons/social/Discord'
import NotionSVG from '~/icons/social/Notion'
import LinkedInSVG from '~/icons/social/LinkedIn'
import TwitchSVG from '~/icons/social/Twitch'
import LineSVG from '~/icons/social/Line'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn('column px-5 py-2.5 text-sm min-h-64 relative'),
    header: cn('text-base mt-2.5 ml-0.5 z-1', fg('text.title')),
    body: cn('flex flex-wrap gap-x-4 gap-y-3 mt-8 min-h-32 mb-5 z-10'),
    socialItem: cn(
      'row-center h-9 px-2 rounded-lg border',
      fg('text.digest'),
      br('divider'),
      'font-medium',
      `hover:${bg('hoverBg')}`,
      `hover:${fg('text.title')}`,
      'pointer',
      // hoverable('bg')
    ),
    iconBox: 'align-both size-8',
    //
    icon: 'size-5 -mt-0.5',
    footer: cn('row-center-between mt-4 ml-0.5 text-sm', fg('text.digest')),
  }
}

export const SocialIcon = {
  Google: GoogleSVG,
  Facebook: FacebookSVG,
  Twitter: TwitterSVG,
  Github: GithubSVG,
  Discord: DiscordSVG,
  Notion: NotionSVG,
  Linkedin: LinkedInSVG,
  Line: LineSVG,
  Twitch: TwitchSVG,
}
