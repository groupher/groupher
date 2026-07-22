import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon({
  active,
  actionVisible,
}: {
  active: boolean
  actionVisible: boolean
}) {
  const { cn, bg, fg, hover, fill, primary } = useTwBelt()

  return {
    wrapper: cn(
      'group row-center h-7 rounded-md px-1 pointer',
      active && 'bold-sm',
      active && bg('hoverBg'),
      hover('box'),
    ),
    pickerSlot: 'align-both mr-2 size-5 shrink-0',
    markerReadonly: 'pointer-events-none',
    titleCluster: 'row-center min-w-0 flex-1 gap-1 leading-5',
    titleButton: cn(
      'min-w-0 max-w-full text-left plain-button text-sm leading-5 truncate pointer',
      !active && `hover:${fg('title')}`,
      active ? primary('fg') : fg('digest'),
    ),
    badge: cn(
      'ml-2 shrink-0 rounded px-1 py-px text-xs leading-none',
      bg('rainbow.redLite'),
      fg('rainbow.red'),
    ),
    meta: 'row-center ml-auto h-5 shrink-0',
    publishDotSlot: cn(
      'align-both w-6 shrink-0 overflow-hidden pl-2 opacity-100',
      'group-hover:w-0 group-hover:opacity-0',
      'group-focus-within:w-0 group-focus-within:opacity-0',
      actionVisible && 'w-0 opacity-0',
    ),
    unpublishedDot: cn('block size-1.5 shrink-0 rounded-full', primary('bg')),
    actions: cn(
      'row-center w-0 overflow-hidden opacity-0',
      'group-hover:w-6 group-hover:pl-2 group-hover:opacity-100',
      'group-focus-within:w-6 group-focus-within:pl-2 group-focus-within:opacity-100',
      actionVisible && 'w-6 pl-2 opacity-100',
    ),
    moreIcon: cn('size-3.5 pointer', fill('digest')),
  }
}
