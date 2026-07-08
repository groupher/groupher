import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, primary } = useTwBelt()

  return {
    wrapper: cn('rich-editor w-full min-h-72 text-base leading-7', fg('digest')),
    paragraph: 'my-3',
    heading1: cn('mt-10 mb-5 text-4xl bold-sm leading-tight', fg('title')),
    heading2: cn('mt-9 mb-4 text-3xl bold-sm leading-tight', fg('title')),
    heading3: cn('mt-8 mb-3 text-2xl bold-sm leading-snug', fg('title')),
    heading4: cn('mt-7 mb-3 text-xl bold-sm', fg('title')),
    heading5: cn('mt-6 mb-2 text-lg bold-sm', fg('title')),
    heading6: cn('mt-5 mb-2 text-base bold-sm', fg('title')),
    blockquote: cn('my-5 border-l-2 pl-4 italic', br('divider'), fg('digest')),
    hr: 'my-8',
    hrLine: cn('border-0 border-t', br('divider')),
    link: cn('underline underline-offset-4', primary('fg')),
    codeBlock: cn('my-5 overflow-x-auto rounded-md px-4 py-3 font-mono text-sm', bg('hoverBg')),
    codeLine: 'font-mono text-sm',
    callout: cn('my-5 rounded-md border px-4 py-3', br('divider'), bg('hoverBg')),
    toggle: cn('my-4 rounded-md border px-4 py-3', br('divider')),
    listLine: 'my-2 row items-start gap-3',
    listMarker: cn('mt-1.5 row-center size-5 shrink-0 text-sm', fg('digest')),
    listText: 'min-w-0 flex-1',
    todoBox: cn('mt-1 row-center size-4 shrink-0 rounded border', br('divider')),
    todoBoxChecked: cn(primary('bg'), primary('border')),
    inlineCode: cn('rounded px-1.5 py-px font-mono text-sm', bg('hoverBg'), fg('title')),
    kbd: cn(
      'rounded border px-1.5 py-px font-mono text-xs',
      br('divider'),
      bg('card'),
      fg('title'),
    ),
    highlight: cn('rounded px-1 py-px', bg('badge'), fg('title')),
  }
}
