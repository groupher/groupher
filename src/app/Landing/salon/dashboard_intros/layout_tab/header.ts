import type { TColorName } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  color: TColorName
}

export default ({ color }: TProps) => {
  const { cn, br, fg, bg, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn('align-both px-4 relative'),
    colorBox: cn(
      'align-both size-7 rounded-md border pointer',
      `hover:${br('text.digest')}`,
      shadow('sm'),
      br('divider'),
      bg('htmlBg'),
    ),
    colorBall: cn('size-5 rounded opacity-65', rainbow(color, 'bg')),
    brand: 'row-center',
    title: cn('text-sm ml-1.5', fg('text.title')),

    bar: cn('absolute h-1.5 w-10 rounded-md opacity-15', rainbow(color, 'bg')),
  }
}
