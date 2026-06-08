import useTwBelt from '~/hooks/useTwBelt'

import { COVER_SHADOW_COLOR_MODE } from '../../../../../constant'
import type { TCoverShadowColorMode } from '../../../../../spec'

export default function useSalon() {
  const { cn, br, primary } = useTwBelt()

  return {
    colorRow: 'grid grid-cols-2 gap-x-4 gap-y-2',
    colorButton: (active: boolean) =>
      cn(
        'row-center min-w-0 gap-2 rounded-md border border-transparent px-1.5 py-1 outline-none trans-all-100 pointer',
        'hover:opacity-100 focus-visible:opacity-100',
        active ? cn(primary('borderSoft'), 'opacity-100') : 'opacity-75',
      ),
    colorSwatch: (mode: TCoverShadowColorMode) =>
      cn(
        'size-4 shrink-0 rounded-full border',
        br('divider'),
        mode === COVER_SHADOW_COLOR_MODE.BLACK && 'bg-black',
        mode === COVER_SHADOW_COLOR_MODE.WHITE && 'bg-white',
        mode === COVER_SHADOW_COLOR_MODE.COLOR && 'bg-rainbow-blue',
        mode === COVER_SHADOW_COLOR_MODE.RAINBOW &&
          'bg-[conic-gradient(from_90deg,#f87171,#facc15,#4ade80,#38bdf8,#c084fc,#f87171)]',
      ),
    colorLabel: 'truncate text-[10px] leading-none',
  }
}
