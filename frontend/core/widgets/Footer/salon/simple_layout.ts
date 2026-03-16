import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'row-between w-full',
    brandLink: cn('text-sm bold no-underline hover:nderline', fg('title')),
    linksInfo: 'row-center gap-x-4',
    linkItem: cn(
      'text-sm no-underline hover:underline pointer',
      `hover:${fg('title')}`,
      fg('digest'),
    ),
  }
}
