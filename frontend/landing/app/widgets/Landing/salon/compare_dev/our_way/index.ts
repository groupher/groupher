import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, rainbow } = useTwBelt()

  return {
    wrapper: 'row-between relative h-[680px] w-[1040px] mt-2.5 px-10 pb-6',
    connectLine: cn(
      'absolute top-1/2 left-8 mt-1 w-11/12 h-2.5 opacity-10 rounded-md z-10',
      rainbow(COLOR.GREEN, 'bg'),
    ),
    nodes: 'row-center gap-x-36 z-20',
    seedIcon: cn(
      'size-6 opacity-65 hover:scale-125 trans-all-200 mt-10 -ml-12 mr-10',
      rainbow(COLOR.GREEN, 'fill'),
    ),
    tadaIcon: 'size-6 opacity-65 hover:scale-125 ml-2 trans-all-200 mt-9 -mr-7 ml-7',
  }
}
