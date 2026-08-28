import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '../../Table/salon'

export { cn } from '~/css'

export default function useSalon() {
  const base = useBase({ loading: false })
  const { avatar, bg, br, cn, fg, rainbow } = useTwBelt()

  return {
    title: base.title,
    cell: cn(base.cell, 'pretty-num'),
    titleCell: 'column min-w-0 w-full gap-y-1 overflow-hidden',
    articleTitle: cn('w-full truncate text-sm bold-sm', fg('title')),
    missingTitle: cn('w-full truncate text-xs', fg('hint')),
    deletedBy: 'column items-end gap-y-1',
    avatar: cn('size-5 rounded-full ring-1 ring-black/10 dark:ring-white/10', avatar()),
    nickname: cn('max-w-28 truncate text-xs', fg('digest')),
    systemActor: cn('text-xs', fg('hint')),
    dates: 'column pretty-num items-end gap-y-1',
    dateLine: cn('row-center gap-x-1.5 whitespace-nowrap text-xs', fg('digest')),
    permanentDateLine: cn('row-center gap-x-1.5 whitespace-nowrap text-xs', fg('hint')),
    actions: 'row justify-end items-center gap-x-1',
    actionButton: 'min-h-10 shrink-0',
    toolbar: 'row-between w-full gap-x-6 ml-1 pb-5 -mt-3',
    summary: cn('row-center gap-x-2 text-sm bold-sm', fg('title')),
    summaryCount: cn('pretty-num text-xs rounded-md px-2 py-0.5', bg('hoverBg'), fg('digest')),
    retentionHint: cn('text-xs text-right text-pretty', fg('hint')),
    empty: cn('align-both min-h-64 text-sm', fg('hint')),
    modalBody: 'px-5 py-4',
    modalTitle: cn('text-lg bold text-balance', fg('title')),
    modalArticleTitle: cn('mt-3 truncate text-sm bold-sm', fg('digest')),
    modalDesc: cn('mt-2 text-sm leading-6 text-pretty', fg('digest')),
    mentionWarning: cn(
      'mt-4 rounded-lg border px-3 py-2.5 text-sm leading-5 text-pretty',
      br('table.border'),
      rainbow(COLOR.RED, 'bgLite'),
      rainbow(COLOR.RED, 'fg'),
    ),
    modalActions: 'row justify-end items-center gap-x-2 mt-6',
    modalButton: 'min-h-10',
  }
}
