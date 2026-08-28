import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, shadow, rainbow } = useTwBelt()

  return {
    wrapper: 'column-align-both w-[440px] h-auto absolute top-16 left-5',
    inner: 'row justify-between w-full px-2.5',
    item: 'align-both px-2.5 py-2 trans-all-200 scale-90 pointer border border-transparent rounded-xl',
    itemActive: cn('scale-100', bg('alphaBg'), br('divider'), shadow('sm')),
    //
    avatar: 'size-10 rounded-md',
    intro: 'ml-3.5',
    nickname: cn('text-sm mb-0.5', fg('digest')),
    desc: cn('text-xs opacity-80', fg('digest')),
    //
    num: cn('text-sm bold-sm', rainbow(COLOR.PINK, 'fg')),
    rootLabel: cn(
      'align-both text-xs bold px-1 ml-px opacity-65 rounded',
      fg('button.fg'),
      rainbow(COLOR.RED, 'bg'),
    ),
  }
}
