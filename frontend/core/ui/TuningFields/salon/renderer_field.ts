import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, bg, br, fg, hover, primary } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.wrapper,
    wrapperStart: base.wrapperStart,
    label: base.label,
    labelStart: base.labelStart,
    content: base.content,
    contentStart: base.contentStart,
    renderers: 'row-start wrap justify-start gap-1.5',
    rendererButton: cn(
      'h-6 px-1.5 rounded-md border text-xs leading-none pointer trans-all-200',
      br('divider'),
      fg('digest'),
      hover('bg'),
    ),
    rendererButtonActive: cn(bg('card'), primary('border'), primary('fg')),
  }
}
