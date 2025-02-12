import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, cut, fill, hoverable } = useTwBelt()

  return {
    wrapper: cn('relative group'),
    title: cn('text-base bold-sm', cut('w-96')),
    body: cn('mt-2.5 mb-6 break-words', fg('text.digest')),
    actions: cn('row-center absolute top-1 group-smoky-65 -ml-52'),
    //
    hintBox: cn('row-center px-1 py-0.5', hoverable('bg')),
    hint: cn('text-xs mr-4', hoverable('fg')),
    editIcon: cn('size-3 mr-2 -mt-px', hoverable('icon')),
    //
    deleteBox: cn('row-center px-1 py-0.5', hoverable('bg-red')),
    deleteIcon: cn('size-3 mr-1 -mt-px', hoverable('icon-red')),
    deleteHint: cn('text-xs', hoverable('fg-red')),
    //
    arrowIcon: cn('size-2.5 rotate-90 mr-1 pointer', fill('text.digest')),
  }
}
