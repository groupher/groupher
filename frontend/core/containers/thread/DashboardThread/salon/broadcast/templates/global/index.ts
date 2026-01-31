import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, primary, sexyBorder } = useTwBelt()

  return {
    wrapper: 'column-align-both s-full gap-4 pb-8',
    arrow: cn('size-3.5 ml-1', primary('fill')),
    divider: sexyBorder(),
  }
}
