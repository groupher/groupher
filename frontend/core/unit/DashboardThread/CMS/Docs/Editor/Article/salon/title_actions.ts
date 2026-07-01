import useTwBelt from '~/hooks/useTwBelt'

import { DOC_EDITOR_TOP_ROW, DOC_EDITOR_TOP_ROW_CONTROL } from '../../salon/layout'

export default function useSalon() {
  const { cn, fg, fill, hover } = useTwBelt()

  return {
    wrapper: cn(
      'row-center gap-4 px-1 rounded-md -ml-0.5 smoky-65',
      DOC_EDITOR_TOP_ROW,
      hover('box'),
    ),
    action: cn(
      'button-reset row-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none',
      DOC_EDITOR_TOP_ROW_CONTROL,
      fg('digest'),
      hover('fg'),
    ),
    icon: cn('size-3.5 opacity-60', fill('digest'), hover('icon')),
  }
}
