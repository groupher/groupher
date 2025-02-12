import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { fill } = useTwBelt()

  return {
    icon: 'size-4 mr-2.5 mt-1',
    info: fill('text.digest'),
    lock: fill('notice.icon'),
  }
}
