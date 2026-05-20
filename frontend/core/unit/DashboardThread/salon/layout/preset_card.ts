import useTwBelt from '~/hooks/useTwBelt'

import { getRotateClass } from './rotate'

export { cn } from '~/css'

type TArgs = {
  active?: boolean
  activeSuppressed?: boolean
  rotateAngle?: number
}

export default function useSalon({
  active = false,
  activeSuppressed = false,
  rotateAngle = 0,
}: TArgs = {}) {
  const { cn, bg, br, fg, primary, shadow } = useTwBelt()
  const showActiveStyle = active && !activeSuppressed
  const rotateClass = getRotateClass(rotateAngle)

  return {
    wrapper: cn('group relative -ml-4 h-36 w-28 pointer', showActiveStyle && 'z-10'),
    card: cn(
      'column relative h-36 w-28 justify-between rounded-md border px-2 py-1.5 text-left trans-all-200',
      rotateClass,
      shadow('sm'),
      bg('card'),
      br('divider'),
      showActiveStyle
        ? cn('-translate-y-4 rotate-3 rounded-lg', primary('borderSoft'), shadow('lg'))
        : 'group-hover:z-10 group-hover:-translate-y-3 group-hover:rotate-6',
    ),
    preview: cn('relative h-24 w-full rounded-sm border', br('divider')),
    title: cn('mt-2.5 text-xs bold-sm', fg('title')),
    checker: 'pointer-events-none absolute top-3 right-3',
  }
}
