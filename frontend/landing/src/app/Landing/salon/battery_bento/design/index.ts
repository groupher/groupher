import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default () => {
  const { cn } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(base.baseCard, 'p-0', base.gradient(COLOR_NAME.BLACK)),
    title: base.introTitle,
    desc: base.introDesc,
    footer: 'column w-full px-6 py-3.5',
  }
}
