import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn(
      'outline-none tabular-nums box-border m-0 list-none relative inline-block w-full bg-none border appearance-none',
      'px-2.5 py-2 rounded-md text-sm text-left leading-normal caret-inherit saturate-0',
      'trans-all-200',
      'min-h-14 overflow-hidden',
      `hover:${br('text.digest')}`,
      `focus:${br('text.digest')}`,
      `active:${br('text.digest')}`,
      br('divider'),
      bg('htmlBg'),
      fg('text.digest'),
    ),
  }
}
