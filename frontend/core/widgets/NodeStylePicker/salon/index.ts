import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, cn, br, fg, hover, shadow } = useTwBelt()

  return {
    wrapper: 'w-fit',
    trigger: cn(
      'align-both size-9 rounded-md border transition-all duration-150',
      br('divider'),
      hover('box'),
    ),
    panel: cn('w-80 pt-1 pb-0.5', shadow('xl')),
    content: 'relative min-h-80 min-w-0',
    tabPanel: 'relative h-full',
    tabPanelHidden:
      'absolute inset-x-0 top-0 max-h-0 overflow-hidden opacity-0 pointer-events-none',
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
    previewIconColor: bg('digest'),
  }
}
