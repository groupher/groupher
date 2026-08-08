import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fill, rainbow } = useTwBelt()

  return {
    wrapper: 'row-center',
    copyIcon: cn('size-4 ml-0.5 pointer', fill('digest')),
    copyedHint: 'align-both',
    copyedText: cn('text-xs', rainbow(COLOR.GREEN, 'fg')),
  }
}
