import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  className: string
  activeClassName: string
  active: boolean
}

export default function useSalon({ className, activeClassName, active }: TProps) {
  const { cn } = useTwBelt()

  return {
    button: cn(className, active && activeClassName),
  }
}
