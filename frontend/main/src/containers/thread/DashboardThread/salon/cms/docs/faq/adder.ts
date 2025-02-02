import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('column justify-center mt-12'),
    notes: cn('text-xs mt-2.5', fg('text.digest')),
    addBtn: cn('w-28'),
    addIcon: cn('size-3.5 mr-1.5', fill('button.fg')),
  }
}
