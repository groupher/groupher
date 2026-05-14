import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, fg, bg, primary } = useTwBelt()

  return {
    wrapper: 'mt-10',
    enableRow: 'row-center mb-4 ml-1 pr-2 text-sm w-full',
    selectorRow: 'row-center justify-end mb-4 pr-2 w-full',
    inner: cn('w-full py-2 rounded-md', bg('sandBox')),
    settingRow: cn('row gap-4 px-4 py-4 border-b last:border-b-0', br('divider')),
    labelGroup: 'w-2/5 min-w-2/5',
    label: cn('text-base', fg('title')),
    hint: cn('mt-1 text-sm', fg('digest')),
    controlGroup: 'w-2/5 row-center gap-3 dark:brightness-65',
    rangeGroup: 'w-2/5',
    slider: 'w-full',
    sliderTrack: cn('relative h-2 rounded-full overflow-visible'),
    colorThumb: cn(
      'absolute top-1/2 z-10 size-5 -translate-x-1/2 rounded-full border-2 border-white bg-[var(--thumb-color)] shadow-md outline-none',
      'ring-1 ring-black/15',
      'pointer',
    ),
    sliderThumb: cn(
      'absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-md outline-none',
      primary('border'),
    ),
    intensityFill: cn('absolute inset-y-0 left-0 rounded-full', primary('bgSoft')),
    output: cn('ml-3 w-11 text-right text-sm', fg('title')),
  }
}
