import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, br, fill, hover } = useTwBelt()

  return {
    wrapper: 'row items-start mt-8 gap-x-14',
    content: 'column',
    folderWrapper: cn('row-center rounded', hover('bg')),
    folderName: cn('row-center grow text-sm px-2.5 py-0.5 pl-4', fg('title')),
    //
    actionWrapper: 'row-center gap-x-1 group-smoky-0',
    dragIcon: cn('size-3 absolute left-1 group-smoky-0', fill('digest')),
    editIcon: cn('size-3 pointer', fill('digest')),
    deleteIcon: cn('size-3 pointer', fill('digest')),
    //
    arrowUpIcon: cn('size-4 -rotate-90 ml-1', fill('digest')),
    arrowDownIcon: cn('size-4 rotate-180 ml-1', fill('digest')),
    customCursor: cn(
      'absolute w-3/5 border-2 border-dashed',
      'before:content-["o"] before:absolute before:-top-2.5 before:-left-2.5 before:text-sm',

      br('digest'),
    ),
  }
}
