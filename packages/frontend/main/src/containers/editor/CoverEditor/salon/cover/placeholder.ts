import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, br, fill } = useTwBelt()

  return {
    wrapper: cn(
      'column-align-both w-[680px] h-[400px] rounded relative overflow-hidden border',
      br('divider'),
    ),
    uploadIcon: cn('size-12 opacity-65 mb-4', fill('text.digest')),
    title: cn('bold-sm mb-1 text-base opacity-65', fg('text.title')),
    desc: cn('text-xs opacity-65', fg('text.digest')),
  }
}
