import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  open: boolean
}

export default ({ open }: TProps) => {
  const { cn, bg, br, shadow, actionIcon } = useTwBelt()

  return {
    wrapper: cn(
      'group align-both absolute top-10 size-7 circle border z-20 trans-all-100 pointer',
      bg('card'),
      br('divider'),
      shadow('sm'),
      open ? 'left-44' : 'left-0',
    ),
    arrowIcon: actionIcon(),
    listIcon: actionIcon('size-3.5 opacity-65'),
  }
}
