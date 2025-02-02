import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, br, primary, fill } = useTwBelt()

  const link = cn(
    'row-center text-sm rounded px-1.5 h-8 pointer no-underline',
    `hover:${fg('text.title')}`,
    `hover:${bg('hoverBg')}`,
    fg('text.digest'),
  )

  return {
    link,
    menuLink: cn(
      link,
      'border border-transparent',
      `hover:${bg('menuHoverBg')}`,
      `hover:${br('divider')}`,
    ),
    linkActive: cn(primary('fg'), bg('hoverBg')),
    arrowIcon: cn('absolute size-3.5 right-px -rotate-90', fill('text.digest')),
  }
}
