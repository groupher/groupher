import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('column w-52 min-h-24 pl-2.5'),
    communityLogo: 'size-8',
    header: 'row-center mb-1.5',
    info: 'column grow ml-4',
    title: cn('text-base bold-sm', fg('text.title')),
    //
    subsInfo: cn('row-center w-full mt-0.5'),
    subInfo: cn('row-center', fg('text.digest')),
    //
    rawLink: cn(
      'no-underline text-sm opacity-80 mb-px relative pl-1.5 hover:underline',
      fg('text.digest'),
    ),
    desc: cn('text-sm', fg('text.digest')),

    userIcon: cn('size-3 mr-0.5 opacity-80', fill('text.digest')),
    userCount: cn('text-xs', fill('text.title')),
  }
}
