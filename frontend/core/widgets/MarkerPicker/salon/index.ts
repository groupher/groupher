import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  compact?: boolean
  active?: boolean
  color?: TColorName
}

export default function useSalon({ compact = false }: TProps = {}) {
  const { cn, br, fg, hover, shadow } = useTwBelt()

  return {
    wrapper: 'w-fit',
    trigger: compact
      ? cn(
          'button-reset align-both size-4 rounded border-0 bg-transparent p-0 transition-all duration-150',
          hover('bg'),
        )
      : cn(
          'align-both size-9 rounded-md border transition-all duration-150',
          br('divider'),
          hover('box'),
        ),
    panel: cn('w-80 pt-1 pb-0.5', shadow('xl')),
    content: 'relative h-80 min-w-0 overflow-hidden',
    tabPanel: 'abs-full will-change-transform',
    tabPanelActive: 'z-10',
    tabPanelInactive: 'z-0',
    emojiWrapper: cn(
      'pr-0.5',
      '[&_.EmojiPickerReact]:w-full',
      '[&_.EmojiPickerReact]:border-0',
      '[&_.EmojiPickerReact]:shadow-none',
      '[&_.EmojiPickerReact]:rounded-none',
    ),
    emojiPicker: cn(
      '[&_.epr-search]:text-sm',
      '[&_.epr-emoji-category-label]:text-[13px]',
      '[&_.epr-emoji-category-label]:font-semibold',
      '[&_.epr-emoji-category-label]:leading-none',
    ),
    todo: cn('align-both h-80 text-lg', fg('digest')),
  }
}
