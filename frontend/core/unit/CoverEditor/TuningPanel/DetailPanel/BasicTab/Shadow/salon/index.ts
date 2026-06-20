import useTwBelt from '~/hooks/useTwBelt'

import { CHECKER_BG } from '../constant'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fill, primary } = useTwBelt()

  return {
    wrapper: 'relative align-both w-24 h-16 overflow-visible',
    previewCard: cn(
      'relative w-24 aspect-[71/40] overflow-hidden rounded-md border p-0 select-none',
      br('divider'),
      CHECKER_BG,
    ),
    frameBlock: 'absolute rounded-sm pointer-events-none',
    frameFill: cn('abs-full rounded-sm pointer-events-none opacity-85', primary('bg')),
    settingButton: cn(
      'align-both size-5 rounded-none plain-button outline-none pointer trans-all-100',
      'hover:scale-110 focus-visible:scale-110',
    ),
    settingIcon: cn('size-4', fill('digest')),
  }
}
