import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  open: boolean
}

export default ({ open }: TProps) => {
  const { cn, bg, br, shadow, fill } = useTwBelt()

  return {
    wrapper: cn(
      'group align-both absolute top-40 size-7 circle border z-20 trans-all-100 pointer',
      bg('card'),
      br('divider'),
      shadow('sm'),
      open ? 'left-48' : 'left-0',
    ),
    arrowIcon: cn('size-4 trans-all-100', fill('text.digest'), `group-hover:${fill('text.title')}`),
    listIcon: cn('size-3 trans-all-100', fill('text.digest'), `group-hover:${fill('text.title')}`),
  }
}
