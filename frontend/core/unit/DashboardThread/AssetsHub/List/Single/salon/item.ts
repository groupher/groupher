import useTwBelt from '~/hooks/useTwBelt'

import { assetLinearHover } from '../../salon/hover'

export default function useSalon({ selected }: { selected: boolean }) {
  const { cn, fg, br, primary } = useTwBelt()

  return {
    actions:
      'absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
    main: 'column min-w-0 flex-1 justify-center',
    meta: cn('mt-0.5 truncate text-xs leading-4', fg('hint')),
    sideMeta: cn('hidden shrink-0 items-center gap-10 pr-1 text-xs leading-4 md:flex', fg('hint')),
    size: 'w-20 text-right pretty-num',
    title: cn('max-w-full truncate text-left text-sm bold-sm underline-hover', fg('title')),
    uploadedAt: 'w-28 text-right',
    wrapper: cn(
      assetLinearHover(selected),
      'row-center w-full gap-2.5 border-b py-1.5 pr-1 transition-colors',
      selected ? primary('borderLite') : br('divider'),
    ),
  }
}
