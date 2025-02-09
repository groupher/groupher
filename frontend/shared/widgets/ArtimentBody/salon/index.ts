import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn(''),
    body: 'leading-7',
    html: fg('text.digest'),
  }
}
