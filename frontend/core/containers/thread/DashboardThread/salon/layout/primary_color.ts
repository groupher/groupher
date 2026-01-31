import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn, cnMerge } from '~/css'

export default () => {
  const { cn, primary, fg, rainbow } = useTwBelt()

  return {
    content: 'row align-start justify-between',
    head: 'row-center',
    subHead: 'mt-0.5 mb-4',
    block: 'w-2/5 py-2',
    title: cn('text-sm ml-3', fg('title')),
    desc: cn('text-sm pl-0.5 mt-3 leading-loose', fg('digest')),
    ballWrapper: cn('align-both size-9 align-both circle border pointer', primary('borderSoft')),
    subBall: 'size-7',
    colorBall: cn('size-7 circle', primary('bg')),
    subColorBall: cn('size-5', rainbow(COLOR.PURPLE, 'bg')),
  }
}
