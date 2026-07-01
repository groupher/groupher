import { COMMUNITY_LAYOUT } from '~/const'
import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, hover, primary } = useTwBelt()
  const { communityLayout } = useLayout()
  const pageItem = 'pointer'
  const pageTextLink = cn(
    'inline-block w-fit max-w-full truncate transition-colors pointer hover:underline',
    `hover:${primary('fg')}`,
  )

  return {
    wrapper: cn(
      'column-center w-full mt-2.5',
      communityLayout === COMMUNITY_LAYOUT.SIDEBAR && 'pl-24',
    ),
    main: 'grow w-full min-h-96 mt-8',
    groupHeader: 'group/doc-cover-group-title row-center gap-2',
    groupSettingButton: cn(
      'button-reset align-both size-6 rounded opacity-0 transition-opacity duration-150',
      'group-hover/doc-cover-group-title:opacity-70 hover:opacity-100',
      hover('bg'),
    ),
    groupSettingButtonStatic: cn('button-reset align-both size-6 rounded', bg('hoverBg')),
    groupSettingIcon: fg('digest'),
    pageItem,
    pageTextLink,
    tocItem: cn(
      'group row-center w-full text-left pointer transition-colors',
      fg('digest'),
      `hover:${primary('fg')}`,
    ),
    tocText: cn('line-clamp-1 transition-colors text-current group-hover:underline'),
    tocLine: cn(
      'mx-3 mt-0.5 grow border-b border-dashed border-current opacity-30',
      'transition-colors',
    ),
    tocIndex: 'transition-colors text-current',
  }
}
