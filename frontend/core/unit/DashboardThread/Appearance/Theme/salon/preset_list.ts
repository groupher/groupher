import { cn } from '~/css'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export const ROTATE_ANGLES = [6, 3, 2, 6, 12, 2, 3, 6, 12, 3, -2, 6] as const

type TArgs = {
  showForkRelation?: boolean
}

export default function useSalon({ showForkRelation = false }: TArgs = {}) {
  const { fg } = useTwBelt()

  return {
    presetList: cn('row-center mt-2 wrap gap-y-6', !showForkRelation && 'ml-4'),
    customCard: 'order-1 z-10',
    forkedFrom: cn(
      'column-center order-2 mx-3 mt-3 w-20 gap-y-1.5 text-xs italic whitespace-nowrap select-none',
      fg('hint'),
    ),
    forkedFromIconFx: 'relative inline-flex size-5 items-center justify-center overflow-visible',
    forkedFromIcon: 'size-5 rotate-90 opacity-80',
    forkedFromDot:
      'absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current',
    baseCard: 'order-3',
  }
}
