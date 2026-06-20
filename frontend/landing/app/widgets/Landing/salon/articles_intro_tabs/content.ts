import { THREAD } from '~/const/thread'
import useTwBelt from '~/hooks/useTwBelt'
import type { TThread } from '~/spec'

type TProps = {
  tab: TThread
}

export default function useSalon({ tab }: TProps) {
  const { cn } = useTwBelt()

  const bgGradient = 'absolute top-0 left-0 s-full opacity-0 transition-opacity duration-700'

  return {
    wrapper: 'column-align-both relative w-full',
    inner: cn(
      'column-align-both relative w-full trans-all-200',
      tab === THREAD.POST && 'h-[600px]',
      tab === THREAD.KANBAN && 'h-[700px]',
      tab === THREAD.CHANGELOG && 'h-[650px]',
      tab === THREAD.DOC && 'h-[662px]',
    ),
    bgGradientPurple: cn(
      bgGradient,
      'landing-gradient-purple',
      tab === THREAD.POST && 'opacity-100',
    ),
    bgGradientBlue: cn(bgGradient, 'landing-gradient-blue', tab === THREAD.KANBAN && 'opacity-100'),
    bgGradientRed: cn(
      bgGradient,
      'landing-gradient-red',
      tab === THREAD.CHANGELOG && 'opacity-100',
    ),
    bgGradientCyan: cn(bgGradient, 'landing-gradient-cyan', tab === THREAD.DOC && 'opacity-100'),
  }
}
