import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, cut, fill, hover } = useTwBelt()

  return {
    wrapper: 'relative group',
    title: cn('text-base bold-sm', cut('w-96')),
    body: cn('mt-2.5 mb-6 break-words', fg('digest')),
    actions: 'row-center absolute top-1 group-smoky-65 -ml-52',
    //
    hintBox: cn('row-center px-1 py-0.5', hover('bg')),
    hint: cn('text-xs mr-4', hover('fg')),
    editIcon: cn('size-3 mr-2 -mt-px', hover('icon')),
    //
    deleteBox: cn('row-center px-1 py-0.5', hover('bg-red')),
    deleteIcon: cn('size-3 mr-1 -mt-px', hover('icon-red')),
    deleteHint: cn('text-xs', hover('fg-red')),
    //
    arrowIcon: cn('size-2.5 rotate-90 mr-1 pointer', fill('digest')),
  }
}
