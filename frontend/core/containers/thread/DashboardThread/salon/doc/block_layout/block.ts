import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br, fg, fill } = useTwBelt()

  return {
    wrapper: cn(
      'group column relative bg-transparent w-56 h-72 min-h-20 p-4 rounded-md border',
      br('divider'),
      `hover:${br('digest')}`,
    ),
    globalSettingIcon: cn(
      'size-4 absolute top-1 -right-0.5 group-smoky-0',
      fill('digest'),
      `hover:${fill('title')}`,
    ),
    header: 'column mb-3',
    title: cn('text-lg bold mt-2', fg('title')),
    adderBtn: 'w-20 -ml-px mt-2',
    plusIcon: cn('size-2.5 mr-0.5', fill('digest')),
  }
}
