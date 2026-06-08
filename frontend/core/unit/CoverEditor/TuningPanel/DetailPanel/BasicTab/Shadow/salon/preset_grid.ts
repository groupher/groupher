import useTwBelt from '~/hooks/useTwBelt'

import { CHECKER_BG } from '../constant'

export default function useSalon() {
  const { cn, fg, primary } = useTwBelt()

  return {
    presetRow: 'grid grid-cols-4 gap-x-3 gap-y-2',
    presetButton: (active: boolean) =>
      cn(
        'group/preset column-center min-w-0 gap-1 rounded-md border-0 bg-transparent px-0 py-0 outline-none pointer',
        active ? primary('fg') : cn(fg('digest'), `hover:${primary('fg')}`),
      ),
    presetPreview:
      'align-both size-8 overflow-visible rounded-md ring-1 ring-black/10 dark:ring-white/10 ' +
      CHECKER_BG,
    presetBlock: cn(
      'block size-5 rounded-md shadow-[var(--shadow-preview)] ring-1 ring-black/10',
      primary('bg'),
    ),
    presetLabel: (active: boolean) =>
      cn(
        'row-center max-w-full gap-0.5 truncate text-[10px] leading-none text-current trans-all-100',
        active && 'bold-sm',
      ),
    presetCheck: (active: boolean) => cn('size-2.5 shrink-0 fill-current', !active && 'hidden'),
    presetLabelText: 'min-w-0 truncate',
  }
}
