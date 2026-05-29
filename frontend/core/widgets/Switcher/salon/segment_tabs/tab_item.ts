import SIZE from '~/constant/size'
import useTwBelt from '~/hooks/useTwBelt'
import type { TSizeSM } from '~/spec'

export { cn } from '~/css'

type TProps = {
  size: TSizeSM
  active: boolean
  disabled?: boolean
}

export default function useSalon({ size, active, disabled = false }: TProps) {
  const { bg, cn, fg } = useTwBelt()

  const isSmall = size === SIZE.SMALL

  return {
    item: cn(
      'inline-flex items-center justify-center rounded-full border border-transparent',
      'cursor-pointer whitespace-nowrap outline-none transition-colors duration-200',
      'focus-visible:ring-2 focus-visible:ring-offset-1',
      isSmall ? 'h-6 px-2.5 text-xs' : 'h-7 px-2.5 text-sm',
      active
        ? cn('bold-sm', bg('hoverBg'), fg('title'))
        : cn('bg-transparent', fg('digest'), `hover:${bg('hoverBg')}`, `hover:${fg('title')}`),
      disabled && 'cursor-not-allowed opacity-50',
    ),
  }
}
