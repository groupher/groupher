import { BANNER_LAYOUT } from '~/const'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  isSidebarLayout: boolean
}

export default ({ isSidebarLayout }: TProps) => {
  const { cn, fg } = useTwBelt()
  const { bannerLayout } = useLayout()

  return {
    wrapper: cn(
      'row align-start w-full mt-6',
      bannerLayout === BANNER_LAYOUT.SIDEBAR && 'pl-24',
      bannerLayout === BANNER_LAYOUT.TABBER && 'px-1.5',
    ),
    main: cn('w-auto min-h-3/5 bg-transparent mt-6', isSidebarLayout && 'pl-16'),
    intro: 'w-[620px] pb-14',
    state: 'pr-0 pb-8',
    members: 'border-b-none',
    //
    title: cn('text-sm bold-sm mb-4', fg('text.title')),
    desc: cn('text-sm leading-relaxed', fg('text.digest')),
  }
}
