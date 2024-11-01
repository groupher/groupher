import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, container } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full h-full', container()),
    main: 'h-screen',
  }
}
