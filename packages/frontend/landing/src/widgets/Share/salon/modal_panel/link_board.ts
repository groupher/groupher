import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    header: cn('row-center-between'),
    tabs: 'row items-end gap-x-3',
    tabName: cn(
      'text-sm pointer trans-all-200',
      fg('text.digest'),
      `hover:${fg('text.title')}`,
      'hover:bold-sm',
    ),
    tabNameActive: cn('bold-sm', fg('text.title')),
    box: 'row-center mt-2 -ml-2',
    input: 'w-full',
  }
}
