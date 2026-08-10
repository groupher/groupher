import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, br, fg, fill } = useTwBelt()

  return {
    wrapper: 'column min-h-full gap-6 px-6 py-8 sm:px-8',
    header: 'column gap-2',
    title: cn('text-xl bold-sm text-balance', fg('title')),
    desc: cn('max-w-lg text-sm leading-6 text-pretty', fg('digest')),
    actions: 'row flex-wrap gap-3',
    secondaryButton: cn(
      'min-h-10 rounded-lg border px-4 text-sm transition-transform active:scale-96 disabled:cursor-wait disabled:opacity-50',
      br('divider'),
      fg('title'),
      bg('card'),
    ),
    error: 'rounded-lg bg-rainbow-redLite px-4 py-3 text-sm text-rainbow-red',
    list: 'column gap-3',
    empty: cn('rounded-xl px-4 py-8 text-center text-sm', bg('card'), fg('digest')),
    session: cn('row gap-4 rounded-xl p-4 shadow-sm', bg('card')),
    iconBox: cn('align-both size-10 shrink-0 rounded-lg', bg('alphaBg2')),
    icon: cn('size-5', fill('digest')),
    sessionBody: 'column min-w-0 grow gap-1',
    sessionTitle: cn('row flex-wrap items-center gap-2 text-sm bold-sm', fg('title')),
    current: 'rounded-full bg-rainbow-greenLite px-2 py-0.5 text-xs text-rainbow-green',
    meta: cn('text-xs leading-5', fg('digest')),
    revokeButton:
      'min-h-10 shrink-0 rounded-lg px-3 text-sm text-rainbow-red transition-transform hover:bg-rainbow-redLite active:scale-96 disabled:cursor-wait disabled:opacity-50',
  }
}
