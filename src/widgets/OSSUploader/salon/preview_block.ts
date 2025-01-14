import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    previewImg: cn('size-16 rounded-md'),
  }
}
