import useTwBelt from '~/hooks/useTwBelt'

import useDsbSalon from '../../useDsbSalon'

export default function useSalon() {
  const { cn, br } = useTwBelt()
  const dsb = useDsbSalon()

  return {
    wrapper: 'column-center w-8/12 pl-32',
    banner: cn('relative w-full h-36 border-b mb-10', br('divider')),
    tabs: 'absolute bottom-0 -left-2',
    content: 'column w-full',

    card: dsb.card,
    cardActive: dsb.cardActive,
  }
}
