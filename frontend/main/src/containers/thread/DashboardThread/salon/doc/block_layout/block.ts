import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br, fg, fill } = useTwBelt()

  return {
    wrapper: cn(
      'group column relative bg-transparent w-56 h-72 min-h-20 p-4 rounded-md border',
      br('divider'),
      `hover:${br('text.digest')}`,
    ),
    globalSettingIcon: cn(
      'size-4 absolute top-1 -right-0.5 group-smoky-0',
      fill('text.digest'),
      `hover:${fill('text.title')}`,
    ),
    header: 'column mb-3',
    title: cn('text-lg bold mt-2', fg('text.title')),
    adderBtn: 'w-20 -ml-px mt-2',
    plusIcon: cn('size-2.5 mr-0.5', fill('text.digest')),
  }
}
