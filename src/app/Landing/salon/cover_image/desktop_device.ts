import THEME from '~/const/theme'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default () => {
  const { theme, isLightTheme } = useTheme()
  const { cn, fg, bg, fill, shadow, br } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn('column-center relative rounded-lg mt-16 ml-5', 'w-[1000px]', shadow('sm')),

    //
    background: cn(
      'absolute h-full w-full top-0 will-change-transform overflow-hidden rounded-lg trans-all-200',
      theme === THEME.DARK && 'brightness-75',
    ),
    // browser
    brower: cn('align-both w-full h-8 pl-4 rounded-md z-30', bg('cardAlpha')),
    dot: cn(
      'size-2.5 circle mr-1.5',
      isLightTheme ? bg('divider') : cn(bg('text.digest'), 'opacity-40'),
    ),
    addrBar: cn('row-center text-xs -ml-16 px-2 py-0.5 rounded-md border', br('divider')),
    addtext: cn(fg('text.digest'), isLightTheme && 'opacity-80'),
    brand: cn(fg('text.title'), 'mx-0.5'),
    lock: cn('size-3 opacity-65 mr-1', fill('text.digest')),

    threadText: 'clip-text bold ml-0.5',
    threadTextStyle: base.textGradientStyle,
    //
    content: 'relative w-full h-[700px] align-both rounded-b-lg z-10',
  }
}
