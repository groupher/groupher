import useTwBelt from '~/hooks/useTwBelt'
import DiscordSVG from '~/icons/social/Discord'
import FacebookSVG from '~/icons/social/Facebook'
import GithubSVG from '~/icons/social/Github'
import GoogleSVG from '~/icons/social/Google'
import LineSVG from '~/icons/social/Line'
import LinkedInSVG from '~/icons/social/LinkedIn'
import NotionSVG from '~/icons/social/Notion'
import TwitchSVG from '~/icons/social/Twitch'
import TwitterSVG from '~/icons/social/Twitter'

export default function useSalon() {
  const { cn, fg, bg, br, linkable } = useTwBelt()

  return {
    wrapper: 'column px-5 py-2.5 text-sm min-h-64 relative',
    header: cn('text-base mt-2.5 ml-0.5 z-1', fg('title')),
    body: 'row wrap gap-x-4 gap-y-3 mt-8 min-h-32 mb-5 z-10',
    socialItem: cn(
      'row-center h-9 px-2 rounded-lg border',
      fg('digest'),
      br('divider'),
      'font-medium',
      `hover:${bg('hoverBg')}`,
      `hover:${fg('title')}`,
      'pointer',
      // hover('bg')
    ),
    iconBox: 'align-both size-8',
    //
    icon: 'size-5 -mt-0.5',
    footer: cn('row-between mt-4 ml-0.5 text-sm', fg('digest')),
    //
    link: cn(linkable(), fg('digest'), `hover:${fg('title')}`),
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
