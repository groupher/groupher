import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br, bg, shadow, primary } = useTwBelt()

  return {
    wrapper: cn('column-align-both size-20 group/position'),
    block: cn(
      'align-both wrap size-16 rounded border-2 -mt-3.5 gap-x-1',
      'scale-50 group-hover/position:scale-75 group-hover/position:mt-0',
      'trans-all-200',
      br('divider'),
      bg('hoverBg'),
      shadow('sm'),
    ),
    pice: cn(
      'size-4 rounded border pointer trans-all-100',
      br('divider'),
      bg('card'),
      `hover:${primary('border')}`,
    ),
    piceActive: cn(primary('bg')),
    desc: cn('text-xs scale-75 -mt-3.5 group-hover/position:hidden', fg('text.digest')),
  }
}
