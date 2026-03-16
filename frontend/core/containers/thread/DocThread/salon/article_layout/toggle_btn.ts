import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  open: boolean
}

export default function useSalon({ open }: TProps) {
  const { cn, bg, br, shadow, hover } = useTwBelt()

  return {
    wrapper: cn(
      'absolute top-10 size-7 circle border z-20',
      bg('card'),
      hover('bg'),
      br('divider'),
      shadow('sm'),
      open ? 'left-44' : 'left-0',
    ),
    arrowIcon: cn('size-4', hover('icon')),
    listIcon: cn('size-3.5 opacity-65', hover('icon')),
  }
}
