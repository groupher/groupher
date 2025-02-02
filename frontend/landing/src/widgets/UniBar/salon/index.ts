import useTwBelt from '~/hooks/useTwBelt'
import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'

export { cn } from '~/css'

type TProps = {
  expand: boolean
}

export default ({ expand }: TProps) => {
  const { cn, br, fg, bg, fill, global, shadow } = useTwBelt()

  const { inView: badgeInView } = useCommunityDigestViewport()

  const iconBox = cn(
    'size-6 align-both pointer rounded border border-transparent',
    `hover:${bg('hoverBg')}`,
  )
  const icon = cn('size-4 pointer', fill('text.digest'), `hover:${fill('text.title')}`)

  return {
    wrapper: cn(
      'relative border rounded-2xl h-10 trans-all-200 z-20 -ml-0.5',
      badgeInView ? 'w-48' : 'w-52 -ml-2.5',
      expand ? 'h-60' : 'h-10', // add real menu height here
      br('divider'),
      bg('popover.bg'),
      shadow('lg'),
    ),
    shadowMask: cn(
      'absolute -left-14 -bottom-7 w-64 h-28 circle -z-10 blur-sm',
      global('unibar-linear-mask'),
    ),
    topBox: cn(iconBox, badgeInView ? 'max-w-0' : 'max-w-6'),
    iconBox,
    iconActive: cn(bg('hoverBg')),
    tipText: cn('py-0.5 px-1', fg('text.digest')),
    buttonBar: cn(
      'align-both absolute h-[38px] w-full left-px bottom-0 -ml-px rounded-2xl',
      badgeInView ? 'gap-x-2' : 'gap-x-1.5',
      bg('menuHoverBg'),
    ),
    icon,
    iconI18n: cn(icon, 'size-6 mt-0.5 ml-0.5'),
    iconPeopleActive: cn(fill('rainbow.red'), `hover:${fill('rainbow.red')}`),
  }
}
