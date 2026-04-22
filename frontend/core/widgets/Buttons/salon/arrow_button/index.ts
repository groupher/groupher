import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn, cnMerge } from '~/css'

type TProps = {
  disabled: boolean
  dimWhenIdle: boolean
  leftLayout: boolean
  scopeClassName?: string
} & TSpace

export default function useSalon({
  disabled,
  dimWhenIdle,
  leftLayout,
  scopeClassName = '',
  ...spacing
}: TProps) {
  const { cn, margin, linker } = useTwBelt()

  return {
    wrapper: cn(
      'arrow-button row-center relative inline-flex border-none bg-transparent text-sm',
      scopeClassName,
      leftLayout ? 'pl-2' : 'pr-3.5',
      'opacity-65 hover:opacity-100 hover:brightness-110 trans-all-100 pointer',
      linker('fg'),
      margin(spacing),
    ),
    text: 'break-keep whitespace-nowrap',
  }
}
