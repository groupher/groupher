import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, primary } = useTwBelt()

  return {
    motion:
      'shrink-0 overflow-hidden transition-[max-width,opacity,transform,margin] duration-200 ease-out',
    visible: 'ml-1 max-w-44 opacity-100 translate-x-0',
    hidden: 'ml-0 max-w-0 opacity-0 -translate-x-1 pointer-events-none',
    group: 'row-center shrink-0',
    publishButton: cn(
      'h-7 px-3 rounded-l-lg rounded-r-none button-reset text-xs bold-sm pr-1.5 whitespace-nowrap shrink-0 disabled:opacity-60 disabled:cursor-not-allowed',
      primary('bg'),
      fg('button.fg'),
    ),
    optionsButton: cn(
      'align-both h-7 w-7 rounded-r-lg rounded-l-none button-reset disabled:opacity-60 disabled:cursor-not-allowed',
      primary('bg'),
      fg('button.fg'),
    ),
    icon: 'size-4 fill-current',
  }
}
