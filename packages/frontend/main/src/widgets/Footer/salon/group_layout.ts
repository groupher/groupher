import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'row-center w-full',
    inner: 'row justify-between w-full mt-4 mb-7',
    brand: 'column w-2/5',
    brandLogo: 'size-9',
    brandTitle: cn('text-lg bold', fg('text.title')),
    brandDesc: cn('text-sm mt-3.5', fg('text.digest')),
    //
    column: 'column min-w-24',
    title: cn('text-sm mb-3.5', fg('text.title')),
    body: cn('gap-y-3'),
    link: cn(
      'row-center text-sm -ml-px no-underline pointer',
      'hover:underline',
      `hover:${fg('text.title')}`,
      fg('text.digest'),
    ),
  }
}
