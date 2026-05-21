import useTwBelt from '~/hooks/useTwBelt'

import type { TThemePresetCardMode } from '../../spec'
import { getRotateClass } from './rotate'

export { cn } from '~/css'

type TArgs = {
  active?: boolean
  mode?: TThemePresetCardMode
  rotateAngle?: number
}

export default function useSalon({
  active = false,
  mode = 'stacked',
  rotateAngle = 0,
}: TArgs = {}) {
  const { cn, bg, br, fg, primary, shadow } = useTwBelt()
  const isForkMode = mode !== 'stacked'
  const disabled = mode === 'forkBase'
  const rotateClass = getRotateClass(rotateAngle)

  return {
    wrapper: cn(
      'group relative h-36 w-28',
      !isForkMode && '-ml-4',
      disabled ? 'cursor-default' : 'pointer',
      active && 'z-10',
    ),
    card: cn(
      'column relative h-36 w-28 justify-between rounded-md border px-2 py-1.5 text-left trans-all-200',
      rotateClass,
      shadow('sm'),
      bg('card'),
      br('divider'),
      active
        ? cn(
            isForkMode ? 'translate-y-0' : '-translate-y-4',
            'rounded-lg',
            isForkMode ? 'rotate-0' : 'rotate-3',
            primary('borderSoft'),
            shadow('lg'),
          )
        : cn(
            isForkMode ? 'opacity-100 scale-100' : 'opacity-80 scale-95',
            disabled
              ? ''
              : isForkMode
                ? 'group-hover:z-10'
                : 'group-hover:z-10 group-hover:-translate-y-3 group-hover:rotate-6',
          ),
    ),
    preview: cn('relative h-24 w-full rounded-sm border', br('divider')),
    title: cn('mb-1 text-xs', fg('title')),
    checker: 'pointer-events-none absolute top-3 right-3',
  }
}
