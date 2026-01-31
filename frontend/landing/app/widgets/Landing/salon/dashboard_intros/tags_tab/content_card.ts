import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, br, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'absolute bottom-16 left-0 w-[420px] h-[460px] rounded-xl z-10',
      bg('card'),
      shadow('sm'),
    ),
    shadowCover: cn(
      'absolute -left-0.5 w-full h-1/2 -rotate-2 rounded-xl',
      shadow('md'),
      bg('card'),
    ),
    inner: cn('relative border px-6 py-5 s-full rounded-md', br('divider'), bg('card')),
    bar: cn('absolute h-16 w-24 opacity-5 rounded-md', bg('text.digest')),
  }
}
