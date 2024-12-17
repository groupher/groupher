import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, fill } = useTwBelt()

  return {
    wrapper: cn('row-center h-9 mb-5 pl-0.5'),
    backBtn: cn('size-7 rounded-md align-both -ml-1 pointer mr-1.5', `hover:${bg('hoverBg')}`),
    arrow: cn('size-3.5', fill('text.digest')),
  }
}
