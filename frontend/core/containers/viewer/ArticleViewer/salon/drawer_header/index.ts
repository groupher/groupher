import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, hover, sexyVBorder } = useTwBelt()

  return {
    wrapper: 'row-center h-9 my-5 pl-0.5',
    backBtn: cn('size-7 -ml-1 mr-1.5', hover('bg')),
    iconBox: cn('size-7', hover('bg')),
    iconBoxRed: cn('size-7', hover('bg-red')),
    icon: cn('size-3.5', hover('icon')),
    iconRed: cn('size-3.5', hover('icon-red')),
    divider: cn(sexyVBorder(35), 'mr-2 ml-2.5 h-6'),
  }
}
