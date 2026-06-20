import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, cn, fg, br, primary, rainbow, vividDark } = useTwBelt()

  return {
    wrapper: 'px-8 pt-6',
    profile: 'flex items-start',
    avatar: cn('size-11 shrink-0 rounded-md', primary('borderSoft')),
    profileIntro: 'column min-w-flex ml-4',
    profileHeader: 'flex min-w-0 items-baseline',
    nickname: cn('text-sm bold-sm', fg('title')),
    login: cn('text-xs ml-2', fg('hint')),
    bio: cn('mt-2 text-sm leading-6', fg('digest')),
    loading: 'row-center py-16',
    footer: cn('sticky mt-6 bottom-0 z-10 align-both w-full px-6 py-4 gap-x-3', bg('card')),
    rootSign: cn(
      'inline-flex text-xs bold-sm px-1.5 ml-2 rounded-md border',
      fg('button.fg'),
      primary('bg'),
      vividDark(),
    ),
    deleteModal: 'column px-5 py-4 w-full',
    deleteTitle: cn('text-base bold-sm mb-3', rainbow(COLOR.RED, 'fg')),
    deleteDesc: cn('text-sm leading-6 mt-1', fg('title')),
    deleteActions: 'row-center justify-end gap-x-3 mt-4',
    deleteBox: cn('border rounded-lg px-2 py-2 mb-4', br('divider')),
    //
  }
}
