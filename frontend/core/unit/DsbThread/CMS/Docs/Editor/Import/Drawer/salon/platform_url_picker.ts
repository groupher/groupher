import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, br, cn, fg, primary } = useTwBelt()

  return {
    platformForm: cn('column gap-3 rounded-lg p-4', bg('sandBox')),
    platformLabel: cn('text-sm bold-sm', fg('title')),
    platformInputRow: 'row-center gap-2',
    platformInput: cn(
      'h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none',
      'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60',
      br('divider'),
      bg('card'),
      fg('title'),
    ),
    platformSubmit: cn(
      'button-reset h-9 shrink-0 rounded-lg px-3 text-sm',
      'disabled:cursor-not-allowed disabled:opacity-55',
      primary('bg'),
      fg('button.fg'),
    ),
    platformHint: cn('column gap-1 text-xs text-pretty leading-5', fg('digest')),
    platformHintText: '',
  }
}
