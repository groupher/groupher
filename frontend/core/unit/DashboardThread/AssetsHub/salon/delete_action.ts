import { COLOR } from '~/const'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon({
  confirming,
  referenced,
}: {
  confirming: boolean
  referenced: boolean
}) {
  const { cn, fg, bg, rainbow } = useTwBelt()

  return {
    button: cn(
      'align-both size-8 rounded-sm transition-colors disabled:opacity-35 disabled:cursor-not-allowed',
      referenced ? fg('hint') : rainbow(COLOR.RED, 'fg'),
      confirming && rainbow(COLOR.RED, 'bgLite'),
      referenced ? bg('hoverBg') : `hover:${rainbow(COLOR.RED, 'bgLite')}`,
    ),
  }
}
