import useTwBelt from '~/hooks/useTwBelt'
import type { TContainerMetric } from '~/hooks/useTwBelt/spec'

type TProps = {
  containerMetric: TContainerMetric | null
}

export default function useSalon({ containerMetric }: TProps) {
  const { cn, container } = useTwBelt()

  return {
    wrapper: 'w-full min-h-14 mt-20 pt-14 pb-8 footer-inner-shadow',
    inner: cn(
      'column-align-both w-full',
      container(),
      containerMetric && container(containerMetric),
    ),
  }
}
