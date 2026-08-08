import useTwBelt from '~/hooks/useTwBelt'

export { cnMerge } from '~/css'

type TProps = {
  active: boolean
  disabled: boolean
  isCircle: boolean
}

export default function useSalon({ active, disabled, isCircle }: TProps) {
  const { cn, selectable } = useTwBelt()

  return {
    wrapper: cn(
      'relative p-1 shrink-0 trans-all-200 text-left',
      isCircle ? 'circle' : 'rounded-xl',
      disabled && 'opacity-70',
      selectable('box', { active, disabled }),
    ),
    content: cn('row-center s-full overflow-hidden', isCircle ? 'circle' : 'rounded-md'),
    activeSign: selectable('badge', { isCircle }),
    checkIcon: selectable('check', { isCircle }),
  }
}
