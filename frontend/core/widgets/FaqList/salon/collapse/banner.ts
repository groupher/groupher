import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: 'group align-both relative mb-9',
    title: cn('text-xl bold-sm -ml-8', fg('title')),
    menu: 'ml-1.5 pointer group-smoky-0',
    arrowIcon: cn('size-3 rotate-90', fill('digest')),
  }
}
