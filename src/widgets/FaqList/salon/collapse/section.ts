import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  isOpened: boolean
}

export default ({ isOpened }: TProps) => {
  const { cn, cut, fg, fill } = useTwBelt()

  return {
    wrapper: cn('py-4 w-full'),
    header: 'row-center-between pointer group',
    title: cn('text-base bold-sm', isOpened ? fg('text.title') : fg('text.digest'), cut('w-96')),
    arrowIcon: cn('size-4 ml-5 mr-2.5 group-smoky-80 trans-all-200', fill('text.digest')),
    body: cn(
      'text-base trans-all-200 overflow-hidden',
      fg('text.digest'),
      isOpened ? 'mt-3 max-h-auto opacity-100' : 'opacity-0 mt-0 max-h-0',
    ),
  }
}
