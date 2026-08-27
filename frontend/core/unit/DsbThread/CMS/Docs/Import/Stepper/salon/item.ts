import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  completed: boolean
  reached: boolean
}

/** Returns reached/completed presentation classes for one import phase marker. */
export default function useSalon({ completed, reached }: TProps) {
  const { cn, bg, fg, primary } = useTwBelt()

  return {
    wrapper: 'flex flex-1 items-center last:flex-none',
    number: cn(
      'column-align-both size-7 shrink-0 rounded-full text-xs font-semibold tabular-nums',
      reached ? primary('bg') : bg('sandBox'),
      !reached && 'border',
      !reached && primary('border'),
      reached ? fg('button.fg') : primary('fg'),
    ),
    label: cn('ml-2 whitespace-nowrap text-sm', reached ? fg('title') : fg('digest')),
    line: cn('mx-4 h-px flex-1', completed ? primary('bg') : bg('divider')),
  }
}
