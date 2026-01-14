import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn('mt-8 mb-6 overflow-hidden border border-gray-200 rounded-lg'),
    table: cn('w-full text-sm border-collapse'),
    thead: cn('bg-gray-50', fg('text.title'), bg('sandBox')),
    th: cn('px-4 py-3 font-medium text-left whitespace-nowrap'),
    tr: cn('border-t last:border-b-0', br('divider')),
    td: cn('px-4 py-3 align-middle'),

    colUrl: '',
    colStatus: '',
    colAdded: '',

    url: cn('font-medium'),
    added: cn('text-gray-500'),

    statusCell: cn('flex items-center gap-3'),
    statusDot: cn(
      'inline-flex items-center justify-center w-6 h-6 rounded-full border',
      br('divider'),
    ),
    dotVerifying: cn('text-gray-500'),
    dotVerified: cn('text-emerald-600'),
    dotFailed: cn('text-red-600'),
    statusText: cn('text-gray-700'),
  }
}
