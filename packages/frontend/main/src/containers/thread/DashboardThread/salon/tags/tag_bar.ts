import type { TColorName } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  color: TColorName | null
}

export default ({ color }: TProps) => {
  const { cn, br, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('row-center group w-full h-10 p-2.5 border mb-3', br('divider')),
    wrapperEdit: cn('h-12 p-0 ml-2 border-none'),
    dotSelector: cn('align-both size-7 circle border-2 p-0.5 -ml-1.5 mr-1 pointer', br('divider')),
    title: cn('row-center text-sm ml-2.5', fg('text.title')),
    catNote: cn('text-xs ml-3', fg('text.hint')),
    input: 'w-44 h-8 ml-2.5',
    dot: cn('size-5 circle', color && rainbow(color, 'bg')),
  }
}
