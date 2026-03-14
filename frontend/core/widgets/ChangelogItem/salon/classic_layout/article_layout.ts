import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, br, fill } = useTwBelt()

  return {
    wrapper: cn('row items-start pt-3 border-b mb-8 last:border-b-0', br('divider')),
    main: 'w-full min-h-[220px] pb-8',
    title: cn(
      'text-xl font-semibold mb-2.5 mt-8 block no-underline',
      fg('title'),
      'hover:underline pointer',
    ),
    tags: 'row-between mb-4',
    body: cn('text-base leading-[1.85]', fg('digest')),
    footer: 'row-center mt-5 -ml-1.5 mr-3',
    dateTime: cn('text-xs opacity-60 -mt-0.5 mr-1.5', fg('digest')),
    version: cn('text-lg font-medium opacity-60 ml-2', fg('digest')),
    shareIcon: cn('size-3.5', fill('digest')),
  }
}
