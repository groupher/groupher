import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: 'row-center px-1.5 pt-0.5 rounded-md -ml-1 -mt-px',
    selectEmotion: cn('align-both ml-0.5 size-6 circle', bg('hoverBg')),
  }
}
