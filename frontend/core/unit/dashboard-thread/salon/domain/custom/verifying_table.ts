import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: 'mt-8 mb-6 overflow-hidden border border-gray-200 rounded-lg',
    table: 'w-full text-sm border-collapse',
    thead: cn('bg-gray-50', fg('title'), bg('sandBox')),
    th: 'px-4 py-3 font-medium text-left whitespace-nowrap',
    tr: cn('border-t last:border-b-0', br('divider')),
    td: 'px-4 py-3 align-middle',

    colUrl: '',
    colStatus: '',
    colAdded: '',

    url: 'font-medium',
    added: 'text-gray-500',

    statusCell: 'flex items-center gap-3',
    statusDot: cn(
      'inline-flex items-center justify-center w-6 h-6 rounded-full border',
      br('divider'),
    ),
    dotVerifying: 'text-gray-500',
    dotVerified: 'text-emerald-600',
    dotFailed: 'text-red-600',
    statusText: 'text-gray-700',
  }
}
