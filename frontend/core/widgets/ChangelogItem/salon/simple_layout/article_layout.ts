import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: 'row items-start pt-3 mb-8',
    dateTime: cn('text-sm mt-1 w-48', fg('text.digest')),
    main: 'grow w-full min-h-[220px] pb-7.5',
    title: cn('text-lg mb-2 block no-underline', 'hover:underline pointer', fg('text.title')),
    tags: 'row-between mb-2',
    body: cn('text-base leading-[1.85]', fg('text.digest')),
    footer: 'row-center mt-5 -ml-1.5 mr-3',
    version: cn('text-base bold-sm opacity-80 ml-2', fg('text.digest')),
    shareIcon: cn('w-3.5 h-3.5', fill('text.digest')),
  }
}
