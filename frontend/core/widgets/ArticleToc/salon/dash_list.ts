import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, primary } = useTwBelt()

  return {
    wrapper: 'column items-end gap-2.5 w-8 py-2',
    item: 'h-0.5 rounded-sm transition-all duration-150 ease-out hover:scale-x-125 focus-visible:outline-none',
    level2: 'w-3',
    level3: 'w-2',
    active: cn('w-4 opacity-80', primary('bg')),
    idle: 'bg-digest opacity-20 hover:opacity-70',
  }
}
