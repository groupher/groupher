import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  grow: boolean
  multiline: boolean
}

export default function useSalon({ grow, multiline }: TProps) {
  const { cn, fg, fill, hover, bg, br } = useTwBelt()

  return {
    readonly: cn(
      'group/doc-faq-inline-editor row-center min-w-0 max-w-full',
      grow ? 'flex-1' : 'inline-flex',
    ),
    text: cn('min-w-0 truncate', grow && 'grow', fg('digest')),
    editButton: cn(
      'row-center ml-2 size-6 shrink-0 rounded border-0 bg-transparent p-0 opacity-0 trans-all-100',
      'group-hover/doc-faq-inline-editor:opacity-100 focus-visible:opacity-100',
      hover('bg'),
    ),
    editIcon: cn('size-3.5', fill('digest')),
    editLine: cn('row-center min-w-0 max-w-full', grow ? 'w-full' : 'w-fit'),
    editControl: cn('min-w-0 pl-2.5', grow ? 'grow' : 'w-80 max-w-[min(20rem,100%)] pr-2'),
    savingWidth: grow ? 'w-full' : 'w-fit max-w-full',
    input: cn(
      'w-full rounded-md border px-2.5 text-sm outline-none trans-all-200',
      multiline ? 'py-1.5' : 'h-7 py-1',
      multiline ? 'min-h-14 resize-none leading-6' : '',
      br('divider'),
      bg('card'),
      fg('digest'),
      `focus:${br('digest')}`,
    ),
  }
}
