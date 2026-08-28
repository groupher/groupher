import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, fill, hover } = useTwBelt()

  return {
    wrapper: 'group',
    wrapperTarget: '',
    head: 'row-center relative mb-1.5 min-h-8',
    dragHandle: cn(
      'row-center absolute -left-7 top-1/2 size-5 -translate-y-1/2 cursor-grab plain-button opacity-0 trans-all-100',
      'group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
      fill('digest'),
    ),
    titleRow: 'row-center min-w-flex',
    title: cn('text-sm', fg('title')),
    line: cn('ml-4 h-px flex-1', bg('divider')),
    editButton: cn(
      'row-center size-6 shrink-0 rounded plain-button',
      'opacity-0 trans-all-100',
      'group-hover:opacity-100 focus-visible:opacity-100',
      hover('bg'),
    ),
    editIcon: cn('size-3.5', fill('digest')),
    hoverActions: cn(
      'row-center w-0 shrink-0 overflow-hidden opacity-0 trans-all-100',
      'group-hover:w-12 group-hover:opacity-100',
      'group-focus-within:w-12 group-focus-within:opacity-100',
    ),
    actions: 'row-center',
    list: 'column min-h-4',
    listOver: '',
  }
}
