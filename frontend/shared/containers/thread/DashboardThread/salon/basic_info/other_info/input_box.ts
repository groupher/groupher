import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fill } = useTwBelt()

  return {
    wrapper: 'w-full',
    inputWrapper: 'relative',
    deleteIcon: cn(
      'pointer absolute top-2 -right-2',
      'size-5 trans-all-200',
      `hover:${fill('rainbow.red')}`,
      fill('text.digest'),
    ),
  }
}
