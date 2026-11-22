import useTwBelt from '~/hooks/useTwBelt'

import { DOC_EDITOR_CONTENT_BOTTOM_RESERVE } from '../../salon/layout'

export default function useSalon() {
  const { cn, fg, primary, containerWrapper } = useTwBelt()

  return {
    wrapper: cn(
      containerWrapper('article'),
      `column-start col-start-1 row-start-1 w-full min-h-96 ${DOC_EDITOR_CONTENT_BOTTOM_RESERVE}`,
    ),
    beginEdit: cn(
      'row-center h-7 my-3 px-3 rounded-lg button-reset text-xs bold-sm disabled:opacity-60 disabled:cursor-not-allowed',
      primary('bg'),
      fg('button.fg'),
    ),
    error: 'mt-6 mb-8 text-xs text-red-500',
  }
}
