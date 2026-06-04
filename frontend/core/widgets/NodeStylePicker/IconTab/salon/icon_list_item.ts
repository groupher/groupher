import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  active: boolean
}

export default function useSalon({ active }: TProps) {
  const { fg, primary } = useTwBelt()

  return {
    // Provider sprite icons read color from currentColor.
    icon: active ? primary('fg') : fg('digest'),
  }
}
