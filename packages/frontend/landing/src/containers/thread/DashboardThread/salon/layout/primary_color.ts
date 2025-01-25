import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, primary, fg } = useTwBelt()

  return {
    wrapper: 'pb-7',
    content: 'row align-start',
    head: 'row-center',
    subHead: 'mt-0.5 mb-4',
    block: 'w-1/2 pr-6 py-2',
    title: cn('text-sm ml-3', fg('text.title')),
    desc: cn('text-sm pl-0.5 mt-3 leading-loose', fg('text.digest')),
    ballWrapper: cn('align-both size-9 align-both circle border pointer', primary('borderSoft')),
    subBall: 'size-7',
    colorBall: cn('size-7 circle', primary('bg')),
    subColorBall: 'size-5',
  }
}
