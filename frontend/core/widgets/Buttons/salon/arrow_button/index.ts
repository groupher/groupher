import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  disabled: boolean
  dimWhenIdle: boolean
  leftLayout: boolean
} & TSpace

export default ({ disabled, dimWhenIdle, leftLayout, ...spacing }: TProps) => {
  const { cn, margin, linker } = useTwBelt()

  return {
    wrapper: cn(
      'group row-center relative inline-flex border-none bg-transparent bold-sm text-sm',
      leftLayout ? 'pl-2' : 'pr-3.5',
      !leftLayout && 'hover:pr-1',
      'hover:brightness-110 trans-all-100 pointer',
      linker('fg'),
      margin(spacing),
    ),
    text: 'break-keep whitespace-nowrap',
  }
}
