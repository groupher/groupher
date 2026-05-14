import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  active: boolean
}

export default function useSalon({ active }: TProps) {
  const { bg, primary } = useTwBelt()

  return {
    icon: active ? primary('bg') : bg('digest'),
  }
}
