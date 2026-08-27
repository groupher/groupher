import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  dragging: boolean
  pending: boolean
}

/** Returns interaction-aware presentation classes for the local document picker. */
export default function useSalon({ dragging, pending }: TProps) {
  const { cn, bg, br, fg, fill } = useTwBelt()

  return {
    frame: cn('w-full rounded-2xl p-2 shadow-sm', bg('card')),
    input: 'hidden',
    button: cn(
      'column-align-both min-h-52 w-full rounded-lg border border-dashed px-8 py-10',
      'cursor-pointer transition-colors duration-150 disabled:cursor-wait disabled:opacity-70',
      'focus-visible:outline-2 focus-visible:outline-offset-2',
      bg('sandBox'),
      br('divider'),
      dragging && bg('card'),
      dragging && br('digest'),
    ),
    icon: cn(
      'size-8 transition-transform duration-150',
      fill('digest'),
      pending && 'animate-pulse',
    ),
    action: cn('mt-4 text-base font-medium', fg('title')),
    hint: cn('mt-2 max-w-xl text-sm text-pretty', fg('digest')),
  }
}
