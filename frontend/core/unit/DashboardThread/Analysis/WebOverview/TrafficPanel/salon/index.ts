import { cn } from '~/css'

export default function useSalon() {
  return {
    wrapper: 'rounded-md p-5',
    title: 'text-title text-base',
    grid: 'mt-5 grid gap-y-2 text-xs',
    weekday: 'text-title text-center font-medium',
    hour: 'text-digest tabular-nums',
    cell: 'row-center',
    dot: (active: boolean) => cn('size-2.5 rounded-full', !active && 'bg-alphaBg'),
  }
}
