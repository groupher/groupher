import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  slipBarPos: 'top' | 'bottom'
  topSpace: number | string
  bottomSpace: number | string
}

export default function useSalon({ slipBarPos, topSpace, bottomSpace }: TProps) {
  const { cn, bg, fg, vividDark } = useTwBelt()

  return {
    wrapper: cn(
      'row justify-center group relative h-full z-10 px-2',
      slipBarPos === 'top' ? 'pt-0 pb-1.5' : 'pt-1.5 pb-0',
      'text-center m-w-auth pointer trans-all-200',
      fg('title'),
    ),
    label: cn(
      'row-center whitespace-nowrap py-1.5 px-1.5 rounded-md',
      fg('digest'),
      `hover:${bg('hoverBg')}`,
      `hover:${fg('title')}`,
      slipBarPos === 'top' ? `mt-${topSpace}` : `mb-${bottomSpace}`,
    ),
    labelActive: cn('bold-sm', fg('title'), vividDark()),
  }
}
