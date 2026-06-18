import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  compact?: boolean
  active?: boolean
  color?: TColorName
}

export default function useSalon({ compact = false, active = false, color }: TProps = {}) {
  const { bg, cn, br, fg, hover, primary, rainbow, shadow } = useTwBelt()

  return {
    wrapper: 'w-fit',
    trigger: compact
      ? cn(
          'align-both size-4 rounded bg-transparent border-0 transition-all duration-150',
          hover('bg'),
        )
      : cn(
          'align-both size-9 rounded-md border transition-all duration-150',
          br('divider'),
          hover('box'),
        ),
    panel: cn('w-80 pt-1 pb-0.5', shadow('xl')),
    content: 'relative h-80 min-w-0 overflow-hidden',
    tabPanel: 'absolute inset-0 will-change-transform',
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
    // The trigger preview renders through MarkerRender mask mode.
    previewIconColor: color ? rainbow(color, 'bg') : active ? primary('bg') : bg('digest'),
    // Devicon logos are colored images, not masks; don't pass bg color classes to <img>.
    previewDevLogo: 'object-contain',
  }
}
