import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('row justify-between w-full gap-x-28'),
    sections: 'grow',
  }
}
