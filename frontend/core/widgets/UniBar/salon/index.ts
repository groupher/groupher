import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  expand: boolean
}

export default ({ expand }: TProps) => {
  const { cn, br, fg, bg, fill, shadow } = useTwBelt()
  const { inView: badgeInView } = useCommunityDigestViewport()

  const iconBox = cn(
    'size-6 align-both pointer rounded border border-transparent',
    `hover:${bg('hoverBg')}`,
  )
  const icon = cn('size-4 pointer', fill('digest'), `hover:${fill('title')}`)

  return {
    wrapper: cn(
      'relative border h-10 trans-all-200 z-20 -ml-0.5 rounded-2xl',
      badgeInView ? 'w-48' : 'w-52 -ml-2.5',
      expand && 'rounded-t-none',
      br('divider'),
      bg('popover.bg'),
      shadow('card'),
    ),

    panelWrapper: cn(
      'absolute left-0 bottom-full w-full overflow-hidden',
      expand ? 'h-52 opacity-100 pointer-events-auto' : 'h-0 opacity-0 pointer-events-none',
      'trans-all-200 -mb-2',
      bg('popover.bg'),
      br('divider'),
      shadow('card'),
      'rounded-tl-xl rounded-tr-xl mb-0',
    ),
    mockPeoplePanel: cn('p-4 text-sm', fg('digest')),

    shadowMask: cn(
      'absolute -left-14 -bottom-7 w-64 h-28 circle -z-10 blur-sm',
      'unibar-linear-mask',
    ),

    topBox: cn(iconBox, badgeInView ? 'max-w-0' : 'max-w-6'),
    iconBox,
    iconActive: cn(bg('hoverBg')),
    tipText: cn('py-0.5 px-1', fg('digest')),

    buttonBar: cn(
      'align-both absolute h-[38px] w-full left-px bottom-0 -ml-px rounded-2xl',
      badgeInView ? 'gap-x-2' : 'gap-x-1.5',
      expand && 'rounded-t-none',
      bg('menuHoverBg'),
    ),

    icon,
    iconI18n: cn(icon, 'size-6 mt-0.5 ml-0.5'),
    iconPeopleActive: cn(fill('rainbow.red'), `hover:${fill('rainbow.red')}`),
  }
}
