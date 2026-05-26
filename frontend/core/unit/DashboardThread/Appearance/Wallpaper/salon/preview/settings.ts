import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'grid grid-cols-2 items-center w-full min-h-44 gap-10 px-2 py-5',
    effects: 'w-full',
    effectRows: 'column gap-2',
    angleSettings: 'w-full',
    title: cn('text-sm bold-sm mb-4', fg('digest')),
    switchWrapper: 'row-between h-5 gap-3',
    toggleTitle: cn('text-xs leading-tight', fg('digest')),
  }
}
