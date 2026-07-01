import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {
  minimal: boolean
  width: string
} & TSpace

export default function useSalon({ minimal, width, ...spacing }: TProps) {
  const { cn, margin, bg, fg, fill } = useTwBelt()

  return {
    container: cn('@container', width, margin(spacing)),
    wrapper: cn('row-center h-11 w-full py-2.5 pr-2 rounded-lg', minimal && 'h-8 py-2 mr-0'),
    hint: cn('ml-0.5', fg('title')),
    hintText: cn('whitespace-nowrap', minimal ? 'text-xs' : 'text-sm', fg('title')),
    infoIcon: cn('size-4 mr-2', fill('digest')),
    actions: cn('row-center shrink-0 gap-x-1', minimal && '-mr-1'),
    cancelButton: cn(
      '@max-[13rem]:w-7 @max-[8.5rem]:hidden',
      '[&>div]:h-7 [&>div]:min-w-7 [&>div]:rounded-md [&>div]:px-1.5 [&>div]:text-xs [&>div]:!text-current',
      '@max-[13rem]:[&>div]:w-7 @max-[13rem]:[&>div]:px-0',
      fg('digest'),
      `hover:${bg('hoverBg')}`,
      `hover:${fg('title')}`,
    ),
    saveButton: cn(
      '@max-[10.5rem]:w-7',
      '[&>div]:h-7 [&>div]:min-w-7 [&>div]:rounded-md [&>div]:px-2 [&>div]:text-xs [&>div]:font-medium',
      '@max-[10.5rem]:[&>div]:w-7 @max-[10.5rem]:[&>div]:px-0',
    ),
    cancelIcon: 'size-3.5 shrink-0 fill-current',
    saveIcon: '@max-[10.5rem]:block hidden size-3.5 shrink-0 fill-current',
    cancelLabel: '@max-[13rem]:hidden whitespace-nowrap',
    saveLabel: '@max-[10.5rem]:hidden whitespace-nowrap',
  }
}
