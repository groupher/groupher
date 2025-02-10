import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: 'column-center w-full relative bg-transparent min-h-60 h-auto mb-6 w-full',
    header: '-ml-4',
    banner: cn('row justify-start w-full pl-2'),
    main: 'pr-8 grow',
  }
}
