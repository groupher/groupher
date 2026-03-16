import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { fg } = useTwBelt()

  return {
    wrapper: '',
    body: 'leading-7',
    html: fg('digest'),
  }
}
