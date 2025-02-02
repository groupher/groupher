import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fill, fg } = useTwBelt()

  return {
    donwWrapper: 'row-center',
    doneIcon: cn('size-4', fill('rainbow.green')),
    downHint: cn('text-sm', fg('rainbow.green')),
  }
}
