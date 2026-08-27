import useTwBelt from '~/hooks/useTwBelt'

import { DOC_EDITOR_TOP_ROW, DOC_EDITOR_TOP_ROW_CONTROL } from '../../salon/layout'

export default function useSalon() {
  const { cn, fg, fill, hover } = useTwBelt()
  const action = cn(
    'button-reset row-center gap-2 rounded-md px-1 text-sm smoky-65 disabled:opacity-50 disabled:pointer-events-none',
    DOC_EDITOR_TOP_ROW_CONTROL,
    fg('digest'),
    hover('box'),
  )

  return {
    wrapper: cn('row-center w-full gap-4', DOC_EDITOR_TOP_ROW),
    coverAction: cn(action, '-ml-0.5'),
    importAction: cn(action, 'ml-auto'),
    label: hover('fg'),
    icon: cn('size-3.5 opacity-60', fill('digest'), hover('icon')),
  }
}
