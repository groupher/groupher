import type { TColorName } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  color: TColorName
}

export default ({ color }: TProps) => {
  const { cn, fg, bg, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn('w-80 h-auto rounded-md p-5 mb-6', fg('text.digest'), bg('htmlBg'), shadow('sm')),
    header: 'row-center mb-2.5',
    avatar: cn('size-8 border-2 p-0.5 rounded-lg', rainbow(color, 'border')),
    nickname: cn('ml-2.5 text-sm', fg('text.title')),
  }
}
