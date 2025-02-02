// see example: https://codepen.io/mattbraun/pen/EywBJR

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, br, fg, fill } = useTwBelt()

  return {
    wrapper: cn(
      'absolute bottom-2.5 left-0 w-full h-7 z-10 backdrop-blur-sm border-b rounded-tl-xl rounded-tr-xl',
      bg('alphaBg'),
      br('divider'),
    ),
    bottomWrapper: 'top-2.5 rotate-180',
    topWrapper: 'bottom-2.5',
    //
    textWrapper: cn('align-both h-full rotate-180 text-xs bold-sm', fg('text.title')),
    closeButton: cn('absolute top-0.5 left-4 size-5', fill('text.digest')),
  }
}
