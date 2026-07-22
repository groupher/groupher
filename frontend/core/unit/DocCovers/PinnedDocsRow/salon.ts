import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, br, fg, hover, shadow } = useTwBelt()

  return {
    wrapper: 'w-full mb-8',
    scroller: cn('row gap-4 w-full overflow-x-auto overscroll-x-contain pb-3', 'scrollbar-thin'),
    sortable: 'w-80 shrink-0',
    dragging: 'z-20 opacity-80',
    card: cn(
      'group relative w-80 h-64 shrink-0 overflow-hidden rounded-2xl',
      bg('card'),
      shadow('card'),
    ),
    background: 'absolute inset-0',
    tint: cn('absolute inset-0 opacity-75', bg('cardAlpha')),
    link: 'relative z-10 column h-full p-5 no-underline',
    header: 'column gap-1 pr-20',
    title: cn('m-0 line-clamp-2 text-lg font-semibold leading-6 text-wrap-balance', fg('title')),
    author: cn('text-xs', fg('digest')),
    thumbnail: 'min-h-0 grow mt-4 overflow-hidden',
    actions:
      'absolute right-2 top-2 z-20 row gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
    action: cn(
      'button-reset align-both size-10 rounded-lg transition-transform active:scale-96',
      bg('cardAlpha'),
      hover('bg'),
    ),
    actionIcon: cn('size-4', fg('digest')),
    addButton: cn(
      'column align-both gap-2 w-48 h-64 shrink-0 rounded-2xl border border-dashed transition-transform active:scale-96',
      br('divider'),
      fg('digest'),
      hover('bg'),
    ),
    addIcon: 'size-5',
  }
}
