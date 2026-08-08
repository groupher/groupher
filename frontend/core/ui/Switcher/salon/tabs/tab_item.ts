import useTwBelt from '~/hooks/useTwBelt'

import type { TTabsVariant } from '../../Tabs/spec'

export { cn } from '~/css'

type TProps = {
  slipBarPos: 'top' | 'bottom'
  topSpace: number | string
  bottomSpace: number | string
  variant: TTabsVariant
}

export default function useSalon({ slipBarPos, topSpace, bottomSpace, variant }: TProps) {
  const { cn, bg, fg, vividDark } = useTwBelt()

  return {
    wrapper: cn(
      'row justify-center group relative h-full z-10',
      variant === 'docs' ? 'items-end px-0 py-0 text-sm' : 'px-2',
      variant !== 'docs' && (slipBarPos === 'top' ? 'pt-0 pb-1.5' : 'pt-1.5 pb-0'),
      'text-center m-w-auth pointer transition-colors duration-200',
      fg('title'),
    ),
    label: cn(
      'row-center whitespace-nowrap',
      variant === 'docs' ? 'rounded-none px-0 py-2' : 'rounded-md px-1.5 py-1.5',
      fg('digest'),
      variant !== 'docs' && `hover:${bg('hoverBg')}`,
      `hover:${fg('title')}`,
      variant !== 'docs' && (slipBarPos === 'top' ? `mt-${topSpace}` : `mb-${bottomSpace}`),
    ),
    labelActive: cn('bold-sm', fg('title'), vividDark()),
  }
}
