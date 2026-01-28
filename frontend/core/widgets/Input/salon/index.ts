import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default ({ width }) => {
  const { cn, fill, primary, fg, bg, br } = useTwBelt()

  const addon = 'absolute align-both top-0 size-8 z-10'

  return {
    wrapper: cn('relative group', width),
    addon,
    prefix: cn(addon, 'left-0'),
    suffix: cn(addon, 'right-0'),
    icon: cn('size-3.5 group-smoky-80', fill('digest')),
    iconActive: cn(primary('fill')),
    input: cn(
      'outline-none tabular-nums box-border m-0 list-none relative inline-block w-full bg-none border appearance-none',
      'px-2.5 py-1 h-9 rounded-md text-sm text-left leading-normal caret-inherit saturate-0',
      'placeholder:italic placeholder:opacity-65 placeholder:text-xs',
      'trans-all-200',
      `hover:${br('digest')}`,
      `focus:${br('digest')}`,
      `active:${br('digest')}`,
      br('divider'),
      bg('card'),
      fg('digest'),
    ),
  }
}
