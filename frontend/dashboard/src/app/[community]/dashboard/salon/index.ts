import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column-center justify-start min-h-full w-full'),
    inner: cn('column-center w-full'),
    content: 'row w-full min-h-screen',
    main: 'column items-center mt-7 grow bg-transparent',
  }
}
