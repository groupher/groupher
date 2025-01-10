import { COLOR_NAME } from '~/const/colors'

export { cn } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, avatar, fg, cutRest, rainbow } = useTwBelt()

  return {
    wrapper: cn('row-center relative w-full'),
    baseInfo: cn('row-center grow'),
    headerInfo: 'column w-full',
    user: 'row-center grow text-sm',
    avatar: cn('size-6 mr-3.5', avatar()),
    nickname: cn('text-sm', fg('text.title'), cutRest('w-40')),
    floorNum: cn('text-xs mt-0.5', fg('text.hint')),
    createDate: cn('row-center text-xs ml-0.5', fg('text.hint')),
    //
    refToOther: cn('row-center ml-2', fg('text.digest')),
    refLabel: 'text-xs mt-0.5',
    refUser: cn('text-sm ml-2', cutRest('w-28')),
    shortBio: cn('text-xs mt-px', fg('text.hint'), cutRest('w-64')),
    //
    authorTag: cn(
      'text-xs scale-90 mb-0.5 px-2 py-px ml-1.5 rounded bold-sm',
      rainbow(COLOR_NAME.BLUE, 'bgSoft'),
      rainbow(COLOR_NAME.BLUE, 'fg'),
    ),
  }
}
