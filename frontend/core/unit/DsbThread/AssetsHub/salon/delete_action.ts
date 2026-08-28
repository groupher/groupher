import { COLOR } from '~/const'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon({
  confirming,
  referenced,
}: {
  confirming: boolean
  referenced: boolean
}) {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    button: cn(
      'h-5 pointer px-1 text-xs bold-sm transition-opacity disabled:cursor-not-allowed',
      referenced ? fg('hint') : rainbow(COLOR.RED, 'fg'),
      confirming && rainbow(COLOR.RED, 'fg'),
      referenced && 'opacity-45',
    ),
  }
}
