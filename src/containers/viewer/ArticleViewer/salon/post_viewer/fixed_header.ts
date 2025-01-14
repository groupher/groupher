import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  visible: boolean
}

export default ({ visible }: TProps) => {
  const { cn, fg, bg, cut, sexyBorder } = useTwBelt()

  return {
    wrapper: cn(
      'fixed row-center-between w-full -ml-20 px-16 h-14 backdrop-blur-sm z-50 trans-all-200',
      visible ? 'top-0 opacity-100' : '-top-16 opacity-0',
      bg('alphaBg'),
    ),
    left: 'row-center',
    articleTitle: cn('row-center text-lg', cut('w-72'), fg('text.title')),
    divider: cn(sexyBorder(), 'absolute bottom-0 left-0 w-full'),
  }
}
