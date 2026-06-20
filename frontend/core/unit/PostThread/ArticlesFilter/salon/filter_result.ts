import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { fg } = useTwBelt()

  return {
    wrapper: 'row-center',
    text: fg('digest'),
  }
}
