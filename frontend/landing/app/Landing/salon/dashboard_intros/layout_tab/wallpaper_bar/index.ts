import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, fill, shadow, dimDark } = useTwBelt()

  return {
    wrapper: cn('align-both gap-x-5', dimDark('sm')),
    ballWrapper: cn(
      'align-both group size-8 circle p-1 pointer trans-all-200',
      shadow('md'),
      bg('alphaBg'),
    ),
    ballWrapperActive: cn('size-9', bg('cardAlpha')),
    colorBall: 'size-6 circle',
    colorBallActive: 'size-7',
    //
    curstomBall: cn('align-both size-7 circle', bg('cardAlpha'), shadow('sm')),
    themeIcon: cn('size-5 z-20 opacity-80', fill('text.digest')),
  }
}
