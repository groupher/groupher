import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full mt-32'),
    main: 'align-both w-full relative overflow-hidden h-0',
    mainActive: 'h-full',
    featList: 'column gap-y-4 mt-12',
  }
}
