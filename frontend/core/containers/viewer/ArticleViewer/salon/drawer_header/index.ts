import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, hoverable, sexyVBorder } = useTwBelt()

  return {
    wrapper: cn('row-center h-9 mb-5 pl-0.5'),
    backBtn: cn('size-7 -ml-1 mr-1.5', hoverable('bg')),
    iconBox: cn('size-7', hoverable('bg')),
    iconBoxRed: cn('size-7', hoverable('bg-red')),
    icon: cn('size-3.5', hoverable('icon')),
    iconRed: cn('size-3.5', hoverable('icon-red')),
    divider: cn(sexyVBorder(35), 'mr-2 ml-2.5 h-6'),
  }
}
