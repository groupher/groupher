import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('row justify-center relative min-h-60 w-full'),
    inner: 'w-full',
    article: 'text-base min-h-52 max-w-[600px]',
    bodyHeader: '-mt-4 mb-4',
    comments: 'mt-9',
  }
}
