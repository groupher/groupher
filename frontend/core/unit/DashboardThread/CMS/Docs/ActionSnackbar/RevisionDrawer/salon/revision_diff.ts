import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: 'block w-full min-w-full overflow-hidden rounded-md text-xs leading-5',
    row: cn('flex w-full min-w-full basis-full self-stretch gap-0.5 py-0.5', fg('digest')),
    addedRow: rainbow(COLOR.GREEN, 'bgSoft'),
    removedRow: rainbow(COLOR.RED, 'bgSoft'),
    addedSegment: 'bg-lime-200/80 bold-sm',
    removedSegment: 'bg-red-200/80 bold-sm',
    marker: cn('w-3 shrink-0 select-none text-center font-mono bold-sm leading-5', fg('hint')),
    text: 'min-w-0 flex-1 whitespace-pre-wrap break-words',
    empty: cn('rounded-md px-2 py-2 text-sm', fg('hint')),
  }
}
