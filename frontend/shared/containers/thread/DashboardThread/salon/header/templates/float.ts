import useTwBelt from '~/hooks/useTwBelt'
import useTheme from '~/hooks/useTheme'

import useBase from '.'

export { cn } from '~/css'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, fg, br, bg, fill, shadow } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(base.template, 'row-center-between px-5'),
    active: base.templateActive,
    left: 'row-center gap-x-2.5',
    center: cn(
      'row-center gap-x-6 -ml-4 rounded-2xl px-5 py-2',
      shadow('lg'),
      bg('alphaBg'),
      !isLightTheme && cn('border', br('divider')),
    ),
    linkItem: cn('text-xs pointer trans-all-100', `hover:${fg('text.title')}`, fg('text.digest')),
    accountIcon: cn('size-3 -mt-0.5', fill('text.digest')),
  }
}
