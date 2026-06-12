import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export default function useSalon(spacing: TSpace = {}) {
  const { cn, fg, margin, primary } = useTwBelt()

  return {
    wrapper: margin(spacing),
    enableRow: 'row-center mb-4 pr-2 text-sm w-full',
    selectorRow: 'row-center justify-end mb-4 pr-2 w-full',
    inner: cn('w-full'),
    settingRow: 'row-end gap-4 py-3',
    labelGroup: 'w-2/5 min-w-2/5',
    label: cn('text-base', fg('title')),
    hint: cn('mt-1 text-sm', fg('digest')),
    controlGroup: 'w-2/5 row-center gap-3 dark:brightness-65 pb-1.5',
    rangeGroup: 'w-2/5 pl-px pb-0.5',
    slider: 'w-full cursor-ew-resize',
    sliderTrack: cn('relative w-full h-2 cursor-ew-resize rounded-full overflow-visible'),
    colorThumb: cn(
      'absolute top-1/2 z-10 size-5 rounded-full border-2 border-white bg-[var(--thumb-color)] shadow-md outline-none',
      'ring-1 ring-black/15',
      'cursor-ew-resize',
    ),
    sliderThumb: cn(
      'absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-md outline-none',
      primary('border'),
    ),
    intensityFill: cn('absolute inset-y-0 left-0 rounded-full', primary('bgSoft')),
    output: cn('ml-3 w-11 text-right text-sm', fg('title')),
  }
}
