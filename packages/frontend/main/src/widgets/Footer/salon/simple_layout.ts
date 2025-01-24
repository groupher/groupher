import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'row-center-between w-full',
    brandLink: cn('text-sm bold no-underline hover:nderline', fg('text.title')),
    linksInfo: 'row-center gap-x-4',
    linkItem: cn(
      'text-sm no-underline hover:underline pointer',
      `hover:${fg('text.title')}`,
      fg('text.digest'),
    ),
  }
}
