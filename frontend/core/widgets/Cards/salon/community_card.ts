import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: 'column w-52 min-h-24 pl-2.5',
    communityLogo: 'size-8',
    header: 'row-center mb-1.5',
    info: 'column grow ml-4',
    title: cn('text-base bold-sm', fg('title')),
    //
    subsInfo: 'row-center w-full mt-0.5',
    subInfo: cn('row-center', fg('digest')),
    //
    rawLink: cn(
      'no-underline text-sm opacity-80 mb-px relative pl-1.5 hover:underline',
      fg('digest'),
    ),
    desc: cn('text-sm', fg('digest')),

    userIcon: cn('size-3 mr-0.5 opacity-80', fill('digest')),
    userCount: cn('text-xs', fill('title')),
  }
}
