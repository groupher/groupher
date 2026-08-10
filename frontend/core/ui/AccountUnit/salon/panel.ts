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
  return {
    wrapper: 'column px-5 py-2.5 text-sm min-h-64 relative',
    header: 'text-base mt-2.5 ml-0.5 z-1 text-title',
    body: 'row wrap gap-x-4 gap-y-3 mt-8 min-h-32 mb-5 z-10',
    socialItem:
      'row-center h-9 rounded-lg border border-divider px-2 font-medium text-digest pointer hover:bg-hoverBg hover:text-title',
    iconBox: 'align-both size-8',
    //
    icon: 'size-5 -mt-0.5',
    footer: 'row-between mt-4 ml-0.5 text-sm text-digest',
    //
    link: 'no-underline pointer text-digest hover:text-title hover:underline',
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
