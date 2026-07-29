import useTwBelt from '~/hooks/useTwBelt'

import { assetLinearHover } from '../../salon/hover'

export default function useSalon({ selected }: { selected: boolean }) {
  const { cn, fg, br, primary } = useTwBelt()

  return {
    actions:
      'absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
    main: 'column min-w-0 flex-1 justify-center gap-0.5',
    meta: cn('truncate text-xs leading-4', fg('hint')),
    sideMeta: cn(
      'column shrink-0 items-end justify-center gap-0.5 pr-1 text-xs leading-4',
      fg('hint'),
    ),
    size: 'w-18 text-right pretty-num',
    title: cn('truncate text-left text-sm bold-sm underline-hover', fg('title')),
    uploadedAt: 'w-22 text-right',
    wrapper: cn(
      assetLinearHover(selected),
      'row-center relative min-w-0 gap-2.5 rounded-sm border p-1.5 transition-colors',
      selected ? primary('borderLite') : br('divider'),
    ),
  }
}
