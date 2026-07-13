import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon({ actionVisible }: { actionVisible: boolean }) {
  const { cn, underline, fg, hover } = useTwBelt()

  return {
    wrapper: cn('group row-center min-h-9 w-full gap-x-2 rounded-md px-1', hover('box')),
    wrapperEditing: 'items-start py-1',
    pickerSlot: 'align-both size-8 shrink-0 rounded-lg',
    markerTrigger: '!size-8 !rounded-lg !border-0 !bg-transparent',
    markerEditing: 'pointer-events-none',
    title: cn('min-w-0 flex-1 truncate text-sm leading-8', underline(), fg('digest')),
    actions: cn(
      'row-center ml-auto w-0 shrink-0 overflow-hidden opacity-0',
      'group-hover:w-4 group-hover:opacity-100',
      'group-focus-within:w-4 group-focus-within:opacity-100',
      actionVisible && 'w-4 opacity-100',
    ),
  }
}
