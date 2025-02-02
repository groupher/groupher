import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, fill } = useTwBelt()

  return {
    wrapper: 'row-center w-full mt-3.5 mb-2.5 group',
    brand: cn('row-center rounded px-1.5 py-0.5', bg('hoverBg')),
    favicon: cn('size-4 min-w-4 mr-1.5'),
    siteName: cn('text-xs bold break-keep', fg('text.digest')),
    title: cn('text-xs ml-1 no-underline line-clamp-1 hover:underline', fg('text.digest')),
    arrowBox: cn('align-both size-4 group-smoky-0'),
    arrow: cn('size-3.5', fill('text.digest')),
  }
}
