import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export default function useSalon(spacing: TSpace = {}) {
  const { cn, fg, margin } = useTwBelt()

  return {
    wrapper: margin(spacing),
    inner: cn('w-full'),
    settingRow: 'row-end gap-4 py-3',
    labelGroup: 'w-2/5 min-w-2/5',
    label: cn('text-base', fg('title')),
    hint: cn('mt-1 text-sm', fg('digest')),
    rangeGroup: 'w-2/5 pl-px pb-0.5',
  }
}
