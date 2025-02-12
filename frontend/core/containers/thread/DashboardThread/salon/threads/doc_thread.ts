import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg } = useTwBelt()

  return {
    wrapper: cn(
      'row justify-between wrap py-4 px-5 pr-2 gap-y-4 -mt-2.5 mb-10 -ml-0.5 rounded-lg',
      bg('hoverBg'),
    ),
    section: 'w-full pt-1',
    header: 'row-center w-full',
    title: cn('text-sm', fg('text.title')),
    desc: cn('text-xs mt-1 w-4/5', fg('text.digest')),
  }
}
