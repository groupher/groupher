import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'column w-64 h-40 px-5 py-4 pb-0 rounded-xl',
      'absolute top-10 left-2 rotate-2',
      bg('alphaBg'),
      shadow('md'),
    ),
    header: 'row-center mb-2',
    brand: 'size-3.5 mr-1.5 opacity-65',
    title: cn('text-sm', fg('text.title')),
    desc: cn('text-xs mt-1.5', fg('text.digest')),
    url: cn('text-xs mt-1.5 opacity-80', fg('text.digest')),
  }
}
