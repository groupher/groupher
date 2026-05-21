import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../useAppearanceBaseSalon'

export { cnMerge } from '~/css'

export default function useSalon() {
  const { cn, fg } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.baseSection,
    select: 'row-center gap-8 w-full wrap',
    layout: 'column-align-both',
    block: cn(base.blockBase, 'align-both w-44 h-14'),
    blockActive: base.blockBaseActive,
    preview: 'row-center gap-1.5',
    previewItem: cn('row-center h-7 rounded-lg px-2 text-sm', fg('digest')),
    previewItemInactive: 'opacity-50',
  }
}
