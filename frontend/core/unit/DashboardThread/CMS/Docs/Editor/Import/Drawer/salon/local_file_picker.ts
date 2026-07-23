import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { bg, br, cn, fg, fill } = useTwBelt()

  return {
    filePickerFrame: 'w-full',
    filePicker: cn(
      'column-align-both min-h-40 w-full rounded-lg border border-dashed px-6 py-8',
      'cursor-pointer disabled:cursor-wait disabled:opacity-70',
      'focus-visible:outline-2 focus-visible:outline-offset-2',
      bg('sandBox'),
      br('divider'),
    ),
    filePickerActive: cn(bg('card'), br('digest')),
    filePickerIcon: cn('size-7', fill('digest')),
    filePickerAction: cn('mt-3 text-sm bold-sm', fg('title')),
    filePickerHint: cn('mt-1.5 text-center text-xs text-pretty leading-5', fg('digest')),
  }
}
