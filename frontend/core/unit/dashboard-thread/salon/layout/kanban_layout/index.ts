import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default function useSalon() {
  const { cn } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(base.baseSection),
  }
}
