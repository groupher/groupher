import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, fg, hover } = useTwBelt()

  return {
    dragHandle: cn(
      'align-both absolute -left-7 top-0 size-8 rounded-md cursor-grab opacity-0 trans-all-200',
      'touch-none group-hover/header-link-row:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
      fg('digest'),
    ),
    wrapper: cn(
      'group group/header-link-row relative w-full rounded-md px-2 will-change-transform',
      'border border-transparent trans-all-100',
      hover('box'),
    ),
    dragging: cn('z-10 select-none', bg('sandBox')),
  }
}
