import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: cn('w-full rounded-b-2xl overflow-hidden -mt-2 pt-1', bg('hoverBg')),
    panelContent: 'w-full',
  }
}
