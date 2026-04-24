import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, br, primary, fill } = useTwBelt()

  const link = cn(
    'row-center text-sm rounded px-1.5 h-8 pointer no-underline',
    `hover:${primary('fg')}`,
    `hover:${bg('hoverBg')}`,
    fg('digest'),
  )

  return {
    link,
    menuLink: cn(
      'row-center text-sm rounded px-1.5 h-8 pointer no-underline border border-transparent',
      `hover:${primary('fg')}`,
      `hover:${bg('menuHoverBg')}`,
      `hover:${br('divider')}`,
      fg('digest'),
    ),
    linkActive: cn(primary('fg'), bg('hoverBg')),
    menuLinkActive: cn(primary('fg'), bg('menuHoverBg'), br('divider')),
    arrowIcon: cn('absolute size-3.5 right-px -rotate-90', fill('digest')),
  }
}
