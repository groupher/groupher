import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = {
  className?: string
} & TSpace

export default function useSalon({ className, ...spacing }: TProps) {
  const { bg, cn, fg, linker, margin, primary } = useTwBelt()

  return {
    wrapper: cn(
      'max-w-none text-sm font-normal leading-6',
      fg('digest'),
      className,
      margin(spacing),
    ),
    paragraph: 'my-0 mb-4 text-inherit',
    list: 'my-0 mb-4 list-outside pl-5 text-inherit',
    listItem: 'my-0 pl-1 text-inherit',
    heading: 'my-0 mb-3 font-semibold text-inherit',
    strong: 'font-semibold text-inherit',
    link: cn('font-medium underline underline-offset-2', linker('fg')),
    inlineCode: cn(
      'rounded px-1 py-0.5 font-mono text-[0.92em] font-medium',
      bg('sandBox'),
      primary('fg'),
    ),
    codeBlock: cn('rounded-md p-3 font-mono text-sm', bg('sandBox'), primary('fg')),
    emphasis: 'italic text-inherit',
    quote: cn('font-normal not-italic', fg('digest')),
  }
}
