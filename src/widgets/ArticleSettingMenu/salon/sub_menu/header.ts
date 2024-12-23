import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill, sexyHBorder } = useTwBelt()

  return {
    inner: cn('row-center text-sm bold-sm mt-1 mb-4', fg('text.digest')),
    divider: cn(sexyHBorder(35), '-mt-1 mb-2.5'),
    icon: cn('size-3.5 mr-1', fill('text.digest')),
    questionIcon: cn('size-3.5 pointer', fill('text.digest')),
  }
}
