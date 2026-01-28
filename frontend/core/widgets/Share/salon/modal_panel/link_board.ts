import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    header: cn('row-between'),
    tabs: 'row items-end gap-x-3',
    tabName: cn(
      'text-sm pointer trans-all-200',
      fg('digest'),
      `hover:${fg('title')}`,
      'hover:bold-sm',
    ),
    tabNameActive: cn('bold-sm', fg('title')),
    box: 'row-center mt-2 -ml-2',
    input: 'w-full',
  }
}
