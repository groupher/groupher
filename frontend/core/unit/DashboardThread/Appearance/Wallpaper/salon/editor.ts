import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, primary } = useTwBelt()

  return {
    wrapper: 'relative mt-12 w-full',
    banner: 'row h-10 mb-6 border-b border-divider -ml-2',
    tabItem: (active: boolean) =>
      cn(
        'relative row-center h-full px-2 text-sm pointer trans-all-200',
        active ? cn('bold-sm', fg('title')) : fg('digest'),
      ),
    tabIndicator: cn('absolute left-2 right-2 -bottom-px h-px', primary('bg')),
    content: cn('h-fit'),
  }
}
