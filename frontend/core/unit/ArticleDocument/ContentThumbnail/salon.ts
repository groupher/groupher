import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, br, fg } = useTwBelt()

  return {
    wrapper: cn('column gap-2 h-full overflow-hidden text-sm', fg('title')),
    empty: cn('align-both h-full text-sm', fg('digest')),
    heading: 'font-semibold leading-5 text-wrap-balance',
    paragraph: cn('line-clamp-3 leading-5 text-wrap-pretty', fg('digest')),
    list: 'column gap-1',
    listItem: cn('row gap-2 line-clamp-1', fg('digest')),
    image:
      'w-full max-h-28 rounded-lg object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10',
    callout: cn('rounded-lg px-3 py-2 line-clamp-2', bg('alphaBg'), fg('digest')),
    table: cn('grid grid-cols-4 gap-px overflow-hidden rounded-md border', br('divider')),
    tableCell: cn('h-3', bg('alphaBg')),
    code: cn('m-0 overflow-hidden rounded-lg px-3 py-2 text-xs whitespace-pre-wrap', bg('alphaBg')),
  }
}
