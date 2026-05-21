import useTwBelt from '~/hooks/useTwBelt'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, primary, fg } = useTwBelt()

  return {
    wrapper: 'row align-start justify-between',
    head: 'row-center',
    subHead: 'mt-0.5 mb-4',
    left: 'w-3/5 pr-6',
    right: 'w-2/5',
    title: cn('text-sm ml-3', fg('title')),
    desc: cn('text-sm pl-0.5 mt-3', fg('digest')),
    ballWrapper: cn('align-both size-9 align-both circle border pointer', primary('borderSoft')),
    subBall: 'size-7',
    colorBall: cn('size-7 circle', primary('bg')),
    subColorBall: 'size-5 circle',
  }
}
