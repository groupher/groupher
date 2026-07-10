import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, hover } = useTwBelt()

  return {
    button: cn('button-reset align-both size-5 shrink-0 rounded trans-all-100', hover('box')),
    icon: cn('size-3.5 smoky-65', hover('fg')),
  }
}
