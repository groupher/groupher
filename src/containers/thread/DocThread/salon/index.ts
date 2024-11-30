import { BANNER_LAYOUT } from '~/const'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()
  const { bannerLayout } = useLayout()

  return {
    wrapper: cn('column-center w-full mt-2.5', bannerLayout === BANNER_LAYOUT.SIDEBAR && 'pl-24'),
    faqs: '-ml-10 mb-5 max-w-11/12',
    //
    main: 'grow w-full min-h-96 mt-4 pl-4 pr-20',
  }
}
