import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fg, fill, bg, rainbow, hover } = useTwBelt()

  return {
    wrapper: 'mb-5',
    header: cn('group/group-title row-center min-h-9 mb-2'),
    editBox: cn('row-center h-12 w-full pl-2 rounded-lg saving-bar-right-linear'),
    foldButton: cn('align-both size-5 ml-2 rounded-md', fg('hint'), hover('bg')),
    foldIcon: cn('size-3.5 trans-all-200', fill('digest')),
    title: cn('text-sm font-medium', fg('title')),
    titleEditable: 'pointer hover:underline underline-offset-4',
    error: cn('ml-2 text-xs', fg('rainbow.red')),
    actionGroup: 'row-center',
    iconButton: cn('align-both size-5.5 rounded-md', hover('bg')),
    editIconButton: cn(
      'align-both size-5.5 rounded-md opacity-0 trans-all-200',
      'group-hover/group-title:opacity-100 focus-visible:opacity-100',
      hover('bg'),
    ),
    icon: cn('size-3.5', fill('digest')),
    groupDragHandle: cn(
      'align-both -ml-8 mr-1 size-7 rounded-md cursor-grab opacity-0 trans-all-200',
      'touch-none group-hover/group-title:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
      fill('digest'),
    ),
    groupDragging: cn('relative z-10 select-none', bg('sandBox')),
    dragHandle: cn(
      'align-both absolute -left-8 top-0 size-10 rounded-md cursor-grab opacity-0 trans-all-200',
      'touch-none group-hover/tag-row:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
      fill('digest'),
    ),
    sortableTag: 'group group/tag-row relative w-full will-change-transform',
    sortableTagDragging: cn('z-10 select-none', bg('sandBox')),
    groupInput: 'h-8',
    tags: cn('rounded-md trans-all-200'),
    tagsOver: bg('hoverBg'),
    firstTagEdit: cn('row-center h-11 w-full mb-3 rounded-lg saving-bar-right-linear'),
    dotSelector: cn('align-both size-7 circle border-2 p-0.5 ml-2 mr-2 pointer', br('divider')),
    dot: 'size-5 circle',
    tagInput: 'h-8',
    empty: cn('border border-dashed rounded-md px-3 py-3', br('divider')),
    rainbow,
  }
}
