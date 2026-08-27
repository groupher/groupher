import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {
  density: 'default' | 'compact'
  width: string
} & TSpace

export default function useSalon({ density, width, ...spacing }: TProps) {
  const { cn, margin, bg, fg, fill } = useTwBelt()
  const compact = density === 'compact'

  return {
    container: cn('@container', width, margin(spacing)),
    wrapper: cn('row-center h-11 w-full rounded-lg py-2.5 pr-2', compact && 'mr-0 h-8 py-2'),
    message: 'row-center min-w-0 @max-[18rem]:hidden',
    hint: cn('ml-1', fg('title')),
    hintText: cn(
      'min-w-0 truncate whitespace-nowrap',
      compact ? 'text-xs' : 'text-sm',
      fg('title'),
    ),
    infoIcon: cn('size-4 mr-2', fill('digest')),
    actions: cn('row-center shrink-0 gap-x-1', compact && '-mr-1'),
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
