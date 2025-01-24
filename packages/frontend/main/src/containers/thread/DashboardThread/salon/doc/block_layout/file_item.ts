import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, hoverable } = useTwBelt()

  return {
    wrapper: cn('row-center-between mb-1.5 relative', hoverable('bg')),
    name: cn('text-sm pointer', hoverable('fg')),
    settingIcon: cn('size-3.5 absolute rotate-90 -top-1.5 -right-1', hoverable('icon')),
  }
}
