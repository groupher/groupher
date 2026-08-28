import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default function useSalon() {
  const { cn } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(base.baseCard, 'p-0', base.gradient(COLOR.ORANGE)),
    title: base.introTitle,
    desc: base.introDesc,
    footer: 'column w-full p-4 pl-6',
  }
}
