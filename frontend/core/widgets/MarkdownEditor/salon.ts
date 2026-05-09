import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {
  className?: string
} & TSpace

export default function useSalon({ className, ...spacing }: TProps) {
  const { bg, br, cn, fg, margin, primary } = useTwBelt()

  return {
    wrapper: cn(
      'w-full overflow-hidden rounded-lg border',
      bg('card'),
      br('divider'),
      margin(spacing),
      className,
    ),
    header: cn('row-center h-9 justify-between border-b', bg('sandBox'), br('divider')),
    tabs: 'row-center shrink-0 self-stretch mt-1',
    tab: cn(
      'h-8 px-4 text-sm font-medium outline-none trans-all-100',
      'disabled:cursor-not-allowed disabled:opacity-50',
      fg('digest'),
      `hover:${fg('title')}`,
    ),
    tabActive: cn('rounded-t-lg border border-b-0 mt-px', bg('card'), fg('title'), br('divider')),
    tabInactive: bg('sandBox'),
    toolbar: cn('row-center min-w-0 shrink gap-0.5 px-3', fg('digest')),
    toolButton: cn(
      'align-both h-6 min-w-6 rounded text-sm leading-none outline-none trans-all-100',
      'disabled:cursor-not-allowed disabled:opacity-40',
      `hover:${bg('hoverBg')}`,
      `hover:${fg('title')}`,
      `focus-visible:ring-2 focus-visible:${primary('borderSoft')}`,
    ),
    listGroup: cn(
      'group/list relative h-6 w-6 shrink-0 overflow-hidden rounded trans-all-200',
      'hover:w-20 focus-within:w-20',
    ),
    listTrigger: cn(
      'absolute right-0 top-0',
      'group-hover/list:pointer-events-none group-hover/list:opacity-0',
      'group-focus-within/list:pointer-events-none group-focus-within/list:opacity-0',
    ),
    listOptions: cn(
      'row-center absolute right-0 top-0 h-6 translate-x-5 opacity-0 trans-all-200',
      'group-hover/list:translate-x-0 group-hover/list:opacity-100',
      'group-focus-within/list:translate-x-0 group-focus-within/list:opacity-100',
    ),
    body: cn('px-1 py-1', bg('card')),
    textarea: cn(
      'w-full resize-y border-0 bg-transparent px-2 py-1.5 text-sm leading-6 outline-none',
      'placeholder:opacity-75 disabled:cursor-not-allowed disabled:opacity-60',
      'trans-all-100',
      fg('title'),
    ),
    preview: cn('min-h-40 px-2 py-1.5 text-sm', bg('card')),
    emptyPreview: cn('h-24 rounded-md', bg('hoverBg')),
  }
}
