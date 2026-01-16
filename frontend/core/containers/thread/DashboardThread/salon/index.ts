import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, br } = useTwBelt()

  return {
    content: 'column w-3/5',
    banner: cn('relative h-16 w-full border-b mb-10', br('divider')),
    tabs: 'absolute -left-2 bottom-0',
  }
}
