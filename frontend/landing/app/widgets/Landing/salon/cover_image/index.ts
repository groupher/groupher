import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, rainbow } = useTwBelt()

  return {
    wrapper: 'column-center relative w-[1080px] z-20',
    other: 'w-full relative -z-10',
    //
    test: cn('w-full h-[768px] overflow-hidden', rainbow(COLOR.PINK, 'bg')),
    slideBox: cn('align-both h-auto border', br('divider')),
    coverImg: cn(
      'z-10 object-cover w-full h-[768px] w-[900px] min-w-[900px] animation-fade-up mt-14',
    ),
  }
}
