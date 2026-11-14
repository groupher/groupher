import useTwBelt from '~/hooks/useTwBelt'
import useDsb from '~/stores/dsb/hooks'

export default function useSalon() {
  const { bg, cn, container, containerWrapper, page } = useTwBelt()
  const dashboard = useDsb()

  return {
    wrapper: cn(
      containerWrapper(),
      'column relative isolate s-full min-h-fit',
      'transition-transform transition-shadow backdrop-blur-2xl',
      dashboard.contentShadow && 'shadow-lg',
      bg('pageBg'),
      page(),
    ),
    body: 'relative z-10 w-full',
    inner: cn('column-align-both w-full', container()),
    footer: 'relative z-10 w-full',
  }
}
