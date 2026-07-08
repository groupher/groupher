import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  open: boolean
}

export default function useSalon({ open }: TProps) {
  const { cn, fg, fill, hover } = useTwBelt()

  return {
    wrapper: 'column group/docs-public-tree-group border-b border-transparent -mt-0.5',
    header: cn(
      'group/docs-public-tree-head row-center relative h-7 w-full rounded pr-1 text-left plain-button',
      hover('box'),
    ),
    marker: 'align-both mr-2 size-5 shrink-0',
    title: cn(
      'min-w-0 flex-1 truncate text-sm pointer smoky-65',
      fg('digest'),
      `group-hover/docs-public-tree-head:${fg('title')}`,
    ),
    arrow: cn(
      'ml-1.5 size-3 shrink-0 trans-all-100',
      fill('digest'),
      open ? '-rotate-90' : 'rotate-180',
    ),
    children: cn('column gap-y-1.5 mt-2 min-h-3 border-b border-transparent', !open && 'hidden'),
  }
}
