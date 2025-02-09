import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  open: boolean
}

export default ({ open }: TProps) => {
  const { cn, bg, br, shadow, hoverable } = useTwBelt()

  return {
    wrapper: cn(
      'absolute top-10 size-7 circle border z-20',
      bg('card'),
      hoverable('bg'),
      br('divider'),
      shadow('sm'),
      open ? 'left-44' : 'left-0',
    ),
    arrowIcon: cn('size-4', hoverable('icon')),
    listIcon: cn('size-3.5 opacity-65', hoverable('icon')),
  }
}
