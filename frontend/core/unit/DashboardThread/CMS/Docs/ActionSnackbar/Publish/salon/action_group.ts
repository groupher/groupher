import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, primary } = useTwBelt()

  return {
    motion:
      'shrink-0 overflow-hidden transition-[max-width,opacity,transform,margin] duration-200 ease-out',
    visible: 'ml-1 max-w-44 opacity-100 translate-x-0',
    treeVisible: 'ml-1 max-w-80 opacity-100 translate-x-0',
    hidden: 'ml-0 max-w-0 opacity-0 -translate-x-1 pointer-events-none',
    group: 'row-center shrink-0 transition-opacity duration-150',
    treeGroup: 'row-center shrink-0 gap-2',
    interactive: 'hover:brightness-110 active:brightness-95',
    disabled: 'opacity-60',
    publishButton: cn(
      'row-center h-7 pl-2.5 pr-1.5 rounded-l-lg rounded-r-none button-reset text-xs bold-sm whitespace-nowrap shrink-0 disabled:cursor-not-allowed',
      primary('bg'),
      fg('button.fg'),
    ),
    publishCount: 'pretty-num text-xs opacity-60',
    optionsButton: cn(
      'align-both h-7 w-fit px-2 rounded-r-lg rounded-l-none button-reset disabled:cursor-not-allowed',
      primary('bg'),
      fg('button.fg'),
    ),
    reviewButton: cn(
      'row-center h-7 gap-1.5 px-2.5 rounded-lg button-reset text-xs bold-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed',
      fg('digest'),
      'bg-white/10 hover:bg-white/15 dark:bg-white/10 dark:hover:bg-white/15',
    ),
    reviewCount: cn('pretty-num text-xs opacity-70', fg('digest')),
    treePublishButton: cn(
      'row-center h-7 px-3 rounded-lg button-reset text-xs bold-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed',
      primary('bg'),
      fg('button.fg'),
    ),
    divider: cn('absolute left-0 top-1 h-5 w-px bg-white opacity-20'),
  }
}
