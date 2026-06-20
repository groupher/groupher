import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'row-between w-full',
    brandLink: cn('text-sm bold hover-underline', fg('title')),
    linksInfo: 'row-center gap-x-4',
    linkItem: cn(
      'text-sm hover-underline pointer',
      `hover:${fg('title')}`,
      fg('digest'),
    ),
  }
}
