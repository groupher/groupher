export type TProps = {
  $radius: number
  $space: number
}

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: cn('size-0.5 circle opacity-65 mx-1', bg('text.digest')),
  }
}
