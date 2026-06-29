import useTwBelt from '~/hooks/useTwBelt'

import type { TFgColor } from '..'

export { cn } from '~/css'

type TProps = {
  fgColor?: TFgColor
}

export default function useSalon({ fgColor = 'default' }: TProps = {}) {
  const { cn, fg, bg, br } = useTwBelt()
  const fgClass = fgColor === 'title' ? fg('title') : fg('digest')

  return {
    wrapper: cn(
      'outline-none tabular-nums box-border m-0 list-none relative inline-block w-full bg-none border appearance-none',
      'px-2.5 py-2 rounded-md text-sm text-left leading-normal caret-inherit',
      'trans-all-200',
      'min-h-14 overflow-hidden',
      `hover:${br('digest')}`,
      `focus:${br('digest')}`,
      `active:${br('digest')}`,
      br('divider'),
      bg('card'),
      fgClass,
    ),
  }
}
