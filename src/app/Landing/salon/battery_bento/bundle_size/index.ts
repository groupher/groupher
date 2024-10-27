import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default () => {
  const { cn, rainbow, shadow } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(base.baseCard, base.gradient(COLOR_NAME.PURPLE), 'h-[582px]'),
    banner: 'column w-full pl-5 mb-3.5',
    warningMask: cn(
      'w-full h-3 border-t-2 border-dotted opacity-30 rounded-xl',
      'absolute bottom-0 left-0',
      'group-hover:h-80 saturate-200 brightness-90',
      'trans-jump',
      shadow('sm'),

      rainbow(COLOR_NAME.RED, 'border'),
      rainbow(COLOR_NAME.RED, 'bgSoft'),
    ),
    //
    title: base.introTitle,
    desc: base.introDesc,
  }
}
