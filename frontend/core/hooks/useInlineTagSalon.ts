import { INLINE_TAG_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName, TInlineTagLayout } from '~/spec'

type TProps = { color: TColorName } & { layout?: TInlineTagLayout | null }

export default function useInlineTagSalon({ color, layout }: TProps) {
  const { cn, br, fg, rainbow, rainbowSoft } = useTwBelt()
  const { inlineTagLayout } = useLayout()

  const TAG_LAYOUTS = {
    [INLINE_TAG_LAYOUT.MORANDI]: {
      wrapper: cn('row-center rounded-sm px-1', rainbowSoft(color)),
      title: cn('text-xs keep-all mr-px', fg('title')),
    },
    [INLINE_TAG_LAYOUT.SOFT]: {
      wrapper: cn('row-center rounded-sm px-1', rainbowSoft(color)),
      title: cn('text-xs keep-all mr-px bold-sm', rainbow(color, 'fg')),
    },
    [INLINE_TAG_LAYOUT.SOLID]: {
      wrapper: cn('row-center rounded-md px-1 py-px', rainbow(color, 'bg')),
      title: cn('text-xs keep-all mr-px bold-sm text-white'),
    },
    [INLINE_TAG_LAYOUT.BORDER]: {
      wrapper: cn('row-center rounded-sm px-1 py-px border', br('outline')),
      title: cn('text-xs keep-all mr-px', fg('title')),
    },
    [INLINE_TAG_LAYOUT.SIMPLE]: {
      wrapper: cn('row-center rounded-sm px-1 -ml-1'),
      title: cn('text-xs keep-all mr-px', fg('title')),
    },
  }

  return TAG_LAYOUTS[layout ?? inlineTagLayout]
}
