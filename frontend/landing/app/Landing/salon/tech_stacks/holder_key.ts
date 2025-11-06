import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column w-24 h-24 py-2 pl-2.5', 'keyboard-block', 'shadow-none scale-95'),
    prefix: cn('text-lg mb-1 ml-2 mt-0.5 opacity-50', fg('text.hint')),
    intro: cn('ml-2 text-xs', fg('text.digest')),
    title: cn('text-2xl opacity-60', fg('text.digest')),
  }
}
