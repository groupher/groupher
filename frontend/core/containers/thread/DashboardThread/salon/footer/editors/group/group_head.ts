import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: 'group row-center w-11/12',
    title: cn('text-sm bold-sm', fg('text.title')),
    icon: cn('size-3.5 group-smoky-0 mr-0.5', fill('text.digest')),
  }
}
