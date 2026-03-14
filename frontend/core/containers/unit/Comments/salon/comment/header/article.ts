import { COLOR } from '~/const/colors'

export { cn } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, avatar, fg, cut, rainbow } = useTwBelt()

  return {
    wrapper: 'row-center relative w-full ml-1',
    baseInfo: 'row-center grow',
    headerInfo: 'column w-full',
    user: 'row-center grow text-sm',
    avatar: cn('size-6 mr-3.5', avatar()),
    nickname: cn('text-sm', fg('title'), cut('w-40')),
    floorNum: cn('text-xs mt-0.5', fg('hint')),
    createDate: cn('row-center text-xs ml-0.5', fg('hint')),
    //
    refToOther: cn('row-center ml-2', fg('digest')),
    refLabel: 'text-xs mt-0.5',
    refUser: cn('text-sm ml-2', cut('w-28')),
    shortBio: cn('text-xs mt-px', fg('hint'), cut('w-64')),
    //
    authorTag: cn(
      'text-xs scale-90 mb-0.5 px-2 py-px ml-1.5 rounded bold-sm',
      rainbow(COLOR.BLUE, 'bgSoft'),
      rainbow(COLOR.BLUE, 'fg'),
    ),
  }
}
