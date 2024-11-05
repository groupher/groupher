import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('row-center relative mb-4'),
    input: 'w-96 h-10 rounded-2xl text-lg text-center placeholder:text-base',
  }
}
