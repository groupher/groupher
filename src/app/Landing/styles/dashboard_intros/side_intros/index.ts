import useTwBelt from '~/hooks/useTwBelt'

import type { TColorName } from '~/spec'

export { cn } from '~/css'

type TProps = {
  color: TColorName
}

export default ({ color }: TProps) => {
  const { cn, fg, bg, rainbow } = useTwBelt()

  return {
    wrapper: cn('column w-80 h-auto mt-20'),
    head: 'mb-8',
    footer: 'row-center mt-12 gap-x-5',

    // --
    iconBox: cn('size-12 align-both rounded-lg mb-5', bg('htmlBg')),
    icon: cn('size-6 opacity-50', rainbow(color, 'fill')),
    title: cn('text-2xl', fg('text.title')),
    desc: cn('text-base mt-1', fg('text.digest')),

    barDivider: cn('rounded-md h-px w-28 mt-5 opacity-25', rainbow(color, 'bg')),
  }
}
