import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: 'row items-start pt-3 mb-8',
    dateTime: cn('text-sm mt-1 w-48', fg('digest')),
    main: 'grow w-full min-h-[220px] pb-7.5',
    title: cn('text-lg mb-2 block no-underline', 'hover:underline pointer', fg('title')),
    tags: 'row-between mb-2',
    body: cn('text-base leading-[1.85]', fg('digest')),
    footer: 'row-center mt-5 -ml-1.5 mr-3',
    version: cn('text-base bold-sm opacity-80 ml-2', fg('digest')),
    shareIcon: cn('w-3.5 h-3.5', fill('digest')),
  }
}
