import { COLOR } from '~/const/colors'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, rainbow, shadow } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(base.baseCard, base.gradient(COLOR.PURPLE), 'h-[582px]'),
    banner: 'column w-full pl-5 mb-3.5',
    warningMask: cn(
      'w-full h-3 border-t-2 border-dotted rounded-xl',
      isLightTheme ? 'opacity-30' : 'opacity-65',
      'absolute bottom-0 left-0',
      'group-hover:h-80 saturate-200 brightness-90',
      'trans-jump !duration-500',
      shadow('sm'),

      rainbow(COLOR.RED, 'border'),
      rainbow(COLOR.RED, 'bgSoft'),
    ),
    //
    title: base.introTitle,
    desc: base.introDesc,
  }
}
