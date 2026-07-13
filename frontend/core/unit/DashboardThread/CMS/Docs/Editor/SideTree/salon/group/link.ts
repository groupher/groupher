import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon({ actionVisible }: { actionVisible: boolean }) {
  const { cn, underline, fg, fill, hover } = useTwBelt()

  return {
    wrapper: cn('group row-center h-7 w-full gap-x-2 rounded-md px-1', hover('box')),
    wrapperEditing: 'h-auto items-start py-1',
    pickerSlot: 'align-both size-5 shrink-0',
    markerReadonly: 'pointer-events-none',
    titleCluster: 'row-center min-w-0 flex-1 gap-1 leading-5',
    titleButton: cn(
      'min-w-0 max-w-full text-left plain-button text-sm leading-5 truncate',
      underline(),
      fg('digest'),
    ),
    titleText: '',
    href: cn('max-w-16 truncate text-xs leading-5', fg('hint')),
    meta: 'row-center ml-auto h-5 shrink-0',
    actions: cn(
      'row-center w-0 overflow-hidden opacity-0',
      'group-hover:w-4 group-hover:opacity-100',
      'group-focus-within:w-4 group-focus-within:opacity-100',
      actionVisible && 'w-4 opacity-100',
    ),
    moreIcon: cn('size-3.5 pointer', fill('digest')),
  }
}
