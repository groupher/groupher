import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-12 h-16'),
    iconBox: 'size-12 align-both align-10 mb-1.5',
    name: cn('text-xs', fg('text.title')),

    techIcon: 'size-8 rounded-md',
  }
}
