import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  bottomSpace: number | string
}

export default ({ bottomSpace }: TProps) => {
  const { cn, bg, fg, vividDark } = useTwBelt()

  return {
    wrapper: cn(
      'row justify-center group relative h-full z-10 px-2 py-1.5',
      'text-center m-w-auth pointer trans-all-200',
      fg('title'),
    ),
    label: cn(
      'row-center whitespace-nowrap py-1.5 px-1.5 rounded-md',
      fg('digest'),
      `hover:${bg('hoverBg')}`,
      `hover:${fg('title')}`,
      `mb-${bottomSpace}`,
    ),
    labelActive: cn('bold-sm', fg('title'), vividDark()),
  }
}
