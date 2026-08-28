import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { primary } = useTwBelt()

  return {
    wrapper: 'row-between gap-x-4 text-sm',
    barArea: 'group relative h-7 min-w-0 grow overflow-hidden rounded-md',
    bar: `absolute inset-y-0 left-0 rounded-md opacity-60 group-hover:opacity-100 ${primary('bgLite')}`,
    label: 'relative z-10 block truncate px-2 leading-7 text-title',
    metrics: 'row-center text-digest shrink-0 gap-x-2 tabular-nums',
    value: 'text-title',
    divider: 'h-4 w-px bg-current opacity-25',
  }
}
