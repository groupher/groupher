import { COMMUNITY_LAYOUT } from '~/const'

import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, br, divider } = useTwBelt()
  const { communityLayout } = useLayout()

  return {
    wrapper: cn(
      'column-center w-full mt-2.5',
      communityLayout === COMMUNITY_LAYOUT.SIDEBAR && 'pl-24',
    ),
    faqs: 'mb-5 w-full',
    //
    main: 'grow w-full min-h-96 mt-8',
    divider: cn(divider(), 'mt-12 mb-20'),
    //
    tocItem: 'row-center w-full text-left group pointer',
    articleTitle: cn(
      'text-sm line-clamp-1 transition-colors pointer',
      `group-hover:${fg('title')}`,
      'group-hover:underline',
      fg('digest'),
    ),

    tocLine: cn(
      'mx-3 mt-0.5 grow border-b border-dashed',
      br('divider'),
      `group-hover:${br('digest')}`,
      'group-hover:opacity-50',
      'transition-colors',
    ),
  }
}
