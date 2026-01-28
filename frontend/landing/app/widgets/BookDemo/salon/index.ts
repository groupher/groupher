import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'column-center h-screen w-full',
    inner: 'min-h-2/5 w-4/12 mt-20 ml-14',
    emoji: 'text-3xl ml-0.5 mb-1.5',
    title: cn('text-2xl mt-1 mb-5', fg('title')),
    p: cn('text-base leading-relaxed', fg('digest')),
  }
}
