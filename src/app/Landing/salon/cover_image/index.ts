import useTwBelt from '~/hooks/useTwBelt'
import { COLOR_NAME } from '~/const/colors'

export default () => {
  const { cn, br, rainbow } = useTwBelt()

  return {
    wrapper: cn('column-center relative w-[1080px] z-20'),
    other: 'w-full relative -z-10',
    //
    test: cn('debug w-full h-[768px] overflow-hidden', rainbow(COLOR_NAME.PINK, 'bg')),
    slideBox: cn('align-both h-auto border', br('divider')),
    coverImg: cn(
      'z-10 object-cover w-full h-[768px] w-[900px] min-w-[900px] animation-fade-up debug-g mt-14',
    ),
  }
}
