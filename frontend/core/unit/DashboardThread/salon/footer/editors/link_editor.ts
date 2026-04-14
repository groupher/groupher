import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, rainbow, sexyBorder } = useTwBelt()

  return {
    wrapper: 'w-full group',
    readonly: 'column gap-x-2.5',
    divider: cn(sexyBorder(), 'mb-4'),
    readonlyEditing: 'pt-0',
    readonlyHead: 'row-center',
    actions: 'row-center mr-3 gap-x-1 group-smoky-0',
    //
    label: cn('row-center text-sm', fg('title')),
    editTitle: cn('row-center text-xs mb-2 ml-px', fg('title')),
    //
    editItem: 'row-center w-full mb-3',
    input: 'w-full h-7',
    editWrapper: 'column mt-1',
    footer: 'w-full align-both',
    notifyLabel: cn(
      'text-xs border rounded-md px-1 py-px bold-sm ml-1.5 scale-75',
      rainbow(COLOR.RED, 'fg'),
      rainbow(COLOR.RED, 'borderSoft'),
      rainbow(COLOR.RED, 'bgSoft'),
    ),
    icon: cn('size-3.5 pointer smoky-90', fill('digest')),
  }
}
