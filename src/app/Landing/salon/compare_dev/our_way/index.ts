import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, rainbow } = useTwBelt()

  return {
    wrapper: cn('row-center-between relative h-[680px] w-[1040px] mt-2.5 px-10 pb-6'),
    // connectLine: cn(
    //   'absolute top-1/2 left-8 w-11/12 h-2 opacity-10 rounded-md border-8 border-dashed',
    //   rainbow(COLOR_NAME.GREEN, 'border'),
    // ),
    connectLine: cn(
      'absolute top-1/2 left-8 mt-1 w-11/12 h-2.5 opacity-10 rounded-md',
      rainbow(COLOR_NAME.GREEN, 'bg'),
    ),
    nodes: 'row-center gap-x-36',
    seedIcon: cn(
      'size-6 opacity-65 hover:scale-125 trans-all-200 mt-10 -ml-10 mr-10',
      rainbow(COLOR_NAME.GREEN, 'fill'),
    ),
    tadaIcon: cn('size-6 opacity-65 hover:scale-125 ml-2 trans-all-200 mt-9 -mr-7 ml-7'),
  }
}
