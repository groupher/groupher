import type { TThread } from '~/spec'
import { THREAD } from '~/const/thread'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  tab: TThread
}

export default ({ tab }: TProps) => {
  const { cn, global } = useTwBelt()

  const bgGradient = cn(
    'absolute top-0 left-0 w-full h-full opacity-0 transition-opacity duration-700',
  )

  return {
    wrapper: cn('column-align-both relative w-full'),
    inner: cn(
      'column-align-both relative w-full trans-all-200',
      tab === THREAD.POST && 'h-[600px]',
      tab === THREAD.KANBAN && 'h-[700px]',
      tab === THREAD.CHANGELOG && 'h-[650px]',
      tab === THREAD.DOC && 'h-[662px]',
    ),
    bgGradientPurple: cn(
      bgGradient,
      global('landing-gradient-purple'),
      tab === THREAD.POST && 'opacity-100',
    ),
    bgGradientBlue: cn(
      bgGradient,
      global('landing-gradient-blue'),
      tab === THREAD.KANBAN && 'opacity-100',
    ),
    bgGradientRed: cn(
      bgGradient,
      global('landing-gradient-red'),
      tab === THREAD.CHANGELOG && 'opacity-100',
    ),
    bgGradientCyan: cn(
      bgGradient,
      global('landing-gradient-cyan'),
      tab === THREAD.DOC && 'opacity-100',
    ),
  }
}
