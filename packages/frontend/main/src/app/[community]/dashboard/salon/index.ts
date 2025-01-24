import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column-center justify-start min-h-full w-full'),
    inner: cn('column-center w-full mt-14'),
    content: 'row w-full min-h-screen',
    main: 'ml-28 mt-7 grow bg-transparent',
  }
}
