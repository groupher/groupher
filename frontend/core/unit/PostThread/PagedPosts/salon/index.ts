import { BANNER_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()
  const { globalLayout } = useLayout()

  return {
    wrapper: cn(BANNER_LAYOUT.TABBER === globalLayout && 'pl-2 pr-14'),
  }
}
