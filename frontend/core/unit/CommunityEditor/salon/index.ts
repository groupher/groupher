import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, container, containerWrapper } = useTwBelt()

  return {
    wrapper: cn('s-full', containerWrapper()),
    inner: cn('column-align-both s-full', container()),
    main: 'h-screen',
  }
}
