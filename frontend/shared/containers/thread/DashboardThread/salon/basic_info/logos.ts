import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg } = useTwBelt()

  return {
    wrapper: cn('w-full pb-8 mb-5'),
    faviconBox: cn('size-8 rounded', bg('hoverBg')),
    favicon: cn('w-full h-full'),
    logoBox: cn('size-16', bg('hoverBg')),
    logo: cn('w-full h-full'),

    title: cn('text-sm mb-3', fg('text.title')),
    desc: cn('text-xs mt-2.5 mt-5 opacity-80', fg('text.digest')),
  }
}
