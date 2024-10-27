import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export { cn } from '~/css'

export default () => {
  const { cn, rainbow } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(base.baseCard, 'overflow-hidden', `hover:${rainbow(COLOR_NAME.CYAN, 'border')}`),
    inner: cn(
      'absolute -top-16 -left-16 -ml-2 w-[150%] h-[150%] -z-10 trans-all-200 debug',
      base.gradient(COLOR_NAME.CYAN),
    ),
    //
    footer: 'column w-full pl-5 mb-3.5',
    title: base.introTitle,
    desc: base.introDesc,

    starIcon: cn('absolute size-5 animation-fade-down', rainbow(COLOR_NAME.ORANGE, 'fill')),
  }
}
