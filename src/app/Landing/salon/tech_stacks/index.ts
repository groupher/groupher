import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br, global } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full mt-32'),
    wall: 'align-both w-full mt-20 mb-12',
    inner: cn(
      'align-both justify-between relative w-full h-[340px] border border-l-none border-r-none',
      br('divider'),
    ),
    innerBgWrapper: cn('absolute top-0 left-0 w-full h-full overflow-hidden rounded-xl'),
    slogan: 'column-align-both',
    title: cn('text-3xl bold-sm opacity-70', fg('text.title'), global('text-shadow')),
    desc: cn('text-lg mt-3', fg('text.digest')),
    cadBg: cn('absolute top-0 h-full object-cover z-10 opacity-60'),
  }
}
