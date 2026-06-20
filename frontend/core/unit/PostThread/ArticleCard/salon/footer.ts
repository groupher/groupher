import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { fg } = useTwBelt()

  return {
    wrapper: fg('digest'),
    publish: 'row-center text-sm ml-0.5 mb-2',
    bottom: 'row-between',
  }
}
