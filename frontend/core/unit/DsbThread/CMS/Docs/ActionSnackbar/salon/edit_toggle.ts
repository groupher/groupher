import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, cn, fg, fill, hover } = useTwBelt()

  const itemBase = cn(
    'group row-center relative z-10 h-6 shrink-0 gap-1 rounded-lg button-reset',
    'px-1.5 text-xs bold-sm transition-colors duration-200',
    fg('digest'),
  )

  const indicatorBase = cn(
    'absolute top-0 h-6 rounded-lg border opacity-0 transition-[transform,width,opacity] duration-200',
    bg('hoverBg'),
    'border-divider/60 dark:border-white/10',
  )

  return {
    wrapper: cn(
      'rounded-xl border p-0.5 transition-colors duration-200',
      'border-divider/70 hover:border-digest/45 dark:border-white/15 dark:hover:border-white/25',
    ),
    track: 'row-center relative w-fit gap-0.5',
    indicator: indicatorBase,
    item: cn(itemBase, 'bg-transparent'),
    itemActive: itemBase,
    icon: cn('size-4 shrink-0', fill('digest'), hover('icon')),
    label: cn(
      'ml-1 shrink-0 whitespace-nowrap opacity-85 transition-colors duration-200',
      fg('digest'),
      hover('fg'),
    ),
    labelActive: cn(
      'ml-1 shrink-0 whitespace-nowrap opacity-100 transition-colors duration-200',
      fg('title'),
    ),
  }
}
