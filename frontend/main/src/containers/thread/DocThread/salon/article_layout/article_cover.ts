import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('mt-4'),
    image: 'mb-6 w-full object-cover',
  }
}
