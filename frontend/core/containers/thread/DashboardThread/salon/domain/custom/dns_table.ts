import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn('mt-8 mb-12 overflow-hidden border border-gray-200 rounded-lg'),
    table: 'w-full text-sm border-collapse',
    thead: cn('text-gray-600 bg-gray-50', fg('title'), bg('sandBox')),
    th: 'px-4 py-3 font-medium text-left whitespace-nowrap',
    tr: cn('border-t last:border-b-0', br('divider')),
    td: 'px-4 py-3',
  }
}
