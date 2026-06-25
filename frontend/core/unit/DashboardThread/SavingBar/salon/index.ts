import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {
  minimal: boolean
  width: string
} & TSpace

export default function useSalon({ minimal, width, ...spacing }: TProps) {
  const { cn, margin, bg, fg, fill, primary } = useTwBelt()

  return {
    container: cn('@container', width, margin(spacing)),
    wrapper: cn('row-center h-11 w-full py-2.5 pr-2 rounded-lg', minimal && 'h-8 py-2 mr-0'),
    hint: cn('ml-0.5', fg('title')),
    hintText: cn('whitespace-nowrap', minimal ? 'text-xs' : 'text-sm', fg('title')),
    infoIcon: cn('size-4 mr-2', fill('digest')),
    actions: cn('row-center shrink-0 gap-x-1', minimal && '-mr-1'),
    cancelButton: cn(
      '@max-[13rem]:w-7 @max-[13rem]:justify-center @max-[13rem]:px-0 @max-[8.5rem]:hidden row-center h-7 min-w-7 gap-x-1 rounded-md px-1.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-50',
      fg('digest'),
      `hover:${bg('hoverBg')}`,
      `hover:${fg('title')}`,
    ),
    saveButton: cn(
      '@max-[10.5rem]:w-7 @max-[10.5rem]:justify-center @max-[10.5rem]:px-0 row-center h-7 min-w-7 gap-x-1 rounded-md px-2 text-xs font-medium transition-opacity disabled:pointer-events-none disabled:opacity-60',
      primary('bg'),
      fg('button.fg'),
    ),
    cancelIcon: 'size-3.5 shrink-0 fill-current',
    saveIcon: '@max-[10.5rem]:block hidden size-3.5 shrink-0 fill-current',
    cancelLabel: '@max-[13rem]:hidden whitespace-nowrap',
    saveLabel: '@max-[10.5rem]:hidden whitespace-nowrap',
  }
}
