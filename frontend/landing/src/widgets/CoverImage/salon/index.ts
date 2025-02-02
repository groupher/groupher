import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('w-full h-72 mb-5'),
    imageWrapper: 'max-h-72 overflow-hidden',
    image: 'w-full max-h-72 rounded object-cover',
  }
}
