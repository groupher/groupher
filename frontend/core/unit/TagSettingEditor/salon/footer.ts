export { cn } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, br, cn } = useTwBelt()

  return {
    wrapper: cn(
      'sticky bottom-0 z-10 align-both w-full border-t px-6 py-4',
      bg('card'),
      br('divider'),
    ),
    updateWrapper: 'row-center gap-3',
  }
}
