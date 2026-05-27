import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'grid grid-cols-[0.8fr_0.8fr_1fr_1fr] items-start w-full min-h-32 gap-8',
    effects: 'w-full',
    effectRows: 'column gap-2',
    angleSettings: 'w-full',
    title: cn('text-sm bold-sm mb-4', fg('digest')),
    switchWrapper: 'row-between h-5 gap-3',
    toggleTitle: cn('text-xs leading-tight', fg('digest')),
    rangeRows: 'column gap-4 pt-2',
    customSettings: 'col-span-2 w-full min-w-0',
  }
}
