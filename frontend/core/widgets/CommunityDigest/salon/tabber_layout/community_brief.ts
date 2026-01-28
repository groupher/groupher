import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, br, primary, vividDark, shadow, isDarkBlack, fill } = useTwBelt()

  return {
    wrapper: 'relative mb-3',
    main: 'row relative',
    logoBox: cn('size-24 align-both -mt-10 ml-3.5 rounded-lg border', bg('card'), br('divider')),
    logo: cn('size-20'),
    communityInfo: cn('mt-4 grow'),
    title: cn('text-2xl ml-4 bold-sm', fg('title')),
    cover: 'w-full h-36 object-cover rounded-md mt-3.5 !-z-10',
    coverHolder: cn('w-full h-36 rounded-md mt-3.5', bg('hoverBg')),
    accountWrapper: cn('absolute h-7 top-6 right-3.5 z-10', shadow('lg')),
    actions: cn('row-center mt-3.5 mr-2.5'),
    more: cn('size-4', primary('fill'), isDarkBlack && fill('digest'), vividDark()),
  }
}
