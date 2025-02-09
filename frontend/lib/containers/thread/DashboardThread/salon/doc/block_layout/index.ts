import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column w-full mt-2.5'),
    cats: 'row grow wrap justify-start gap-x-5 gap-y-4 w-full min-h-96 rounded-md mt-1',
  }
}
