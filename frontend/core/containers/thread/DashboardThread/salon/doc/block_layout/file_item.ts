import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, hover } = useTwBelt()

  return {
    wrapper: cn('row-between mb-1.5 relative', hover('bg')),
    name: cn('text-sm pointer', hover('fg')),
    settingIcon: cn('size-3.5 absolute rotate-90 -top-1.5 -right-1', hover('icon')),
  }
}
