import { cn } from '~/css'

export default function useSalon() {
  return {
    wrapper: 'rounded-md py-5',
    title: 'text-title text-base',
    grid: 'mt-5 grid gap-y-2 text-xs',
    state: 'text-digest mt-5 text-sm',
    error: 'mt-5 text-sm text-red-600',
    weekday: 'text-title text-center font-medium',
    hour: 'text-digest tabular-nums',
    cell: 'row-center',
    dot: (active: boolean) => cn('size-2.5 rounded-full', !active && 'bg-alphaBg'),
  }
}
