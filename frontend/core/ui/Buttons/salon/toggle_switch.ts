import SIZE from '~/const/size'
import useTwBelt from '~/hooks/useTwBelt'
import type { TSizeTSM } from '~/spec'

type TProps = { size: TSizeTSM; checked: boolean }

const metric = {
  [SIZE.TINY]: {
    wrapper: 'w-7',
    track: 'h-4 border',
    indicator: 'size-3',
    checked: 'translate-x-3',
    unchecked: 'translate-x-0',
    checkIcon: 'hidden',
  },
  [SIZE.SMALL]: {
    wrapper: 'w-10',
    track: 'h-5 border',
    indicator: 'size-4',
    checked: 'translate-x-5',
    unchecked: 'translate-x-0',
    checkIcon: 'size-2.5',
  },
  [SIZE.MEDIUM]: {
    wrapper: 'w-12',
    track: 'h-6 border-2',
    indicator: 'size-5',
    checked: 'translate-x-6',
    unchecked: 'translate-x-0',
    checkIcon: 'size-3',
  },
} as const

export default function useSalon({ size, checked }: TProps) {
  const { cn, primary, br, bg, shadow } = useTwBelt()
  const m = metric[size]

  return {
    wrapper: cn('row-center shrink-0', m.wrapper, checked && 'hover:brightness-110'),
    track: cn(
      'rounded-2xl w-full pointer relative trans-all-200',
      m.track,
      checked ? primary('border') : br('divider'),
      checked ? primary('bg') : bg('divider'),
    ),
    indicator: cn(
      'align-both absolute left-0.5 top-1/2 -translate-y-1/2 circle trans-all-200',
      m.indicator,
      bg('button.toggle'),
      shadow('md'),
      checked ? m.checked : m.unchecked,
    ),
    checkIcon: cn(
      'opacity-0 transition-opacity',
      m.checkIcon,
      checked && 'opacity-100',
      primary('fill'),
    ),
  }
}
