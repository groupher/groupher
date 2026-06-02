import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  compact?: boolean
  active?: boolean
}

export default function useSalon({ compact = false, active = false }: TProps = {}) {
  const { bg, cn, br, fg, fill, hover, primary, rainbow, shadow } = useTwBelt()

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
    previewIconColor: active ? primary('bg') : bg('digest'),
    colorGrid: 'grid grid-cols-6 gap-3 px-4 pt-3',
    colorButton: 'align-both size-8 circle appearance-none',
    colorDot: (color: TColorName, active: boolean) =>
      cn(
        'size-7 circle align-both border pointer trans-all-100 hover:-mt-0.5',
        color === COLOR.BLACK ? br('outline') : 'border-transparent',
        rainbow(color, 'bg'),
        active && cn('size-8 align-both hover:mt-0', primary('borderSoft'), shadow('md')),
      ),
    colorCheckIcon: cn('size-3', fill('button.fg')),
  }
}
