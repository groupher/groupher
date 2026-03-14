import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, container } = useTwBelt()

  return {
    wrapper: cn('column-align-both s-full', container()),
    main: 'h-screen',
  }
}
