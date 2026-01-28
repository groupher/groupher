import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, br, fill } = useTwBelt()

  return {
    wrapper: cn(
      'group align-both relative w-56 h-72 min-h-20 px-5 py-4 pl-0 border-2 border-dotted rounded-md pointer',
      br('divider'),
      `hover:${br('digest')}`,
    ),
    addIcon: cn('size-12', fill('digest')),
    title: cn('text-sm bold mt-4', fg('digest')),
  }
}
