import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, scrollbar } = useTwBelt()

  return {
    wrapper: 'absolute left-0 top-1 z-20 column max-h-full w-max max-w-48 origin-top-left',
    header: 'row-center w-full shrink-0',
    openButton: cn(
      'button-reset row-center size-7 shrink-0 justify-start smoky-60 transition-transform duration-150 ease-out',
      'smoky-65 mb-4',
      fill('digest'),
      `hover:${fill('title')}`,
    ),
    openIcon: 'size-3.5',
    list: cn('column min-h-0 gap-y-4 overflow-y-auto pb-14 pr-2', scrollbar('thin')),
    empty: cn('px-1 pt-1 text-xs', fg('digest')),
  }
}
