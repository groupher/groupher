import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column-center justify-start min-h-full w-full'),
    inner: cn('column-center w-full'),
    content: 'row w-full min-h-screen mt-7',
    main: 'column items-center grow bg-transparent',
  }
}
