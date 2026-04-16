import { BANNER_LAYOUT } from '~/const'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, divider } = useTwBelt()
  const { globalLayout } = useLayout()

  return {
    wrapper: cn('column-center w-full mt-2.5', globalLayout === BANNER_LAYOUT.SIDEBAR && 'pl-24'),
    faqs: 'mb-5 w-full',
    //
    main: 'grow w-full min-h-96 mt-4 pl-4 pr-20',
    divider: cn(divider(), 'mt-12 mb-20'),
  }
}
