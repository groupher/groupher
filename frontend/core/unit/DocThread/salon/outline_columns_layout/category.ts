import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'
import useBase from '..'

type TProps = {
  color: TColorName
}

export default function useSalon({ color }: TProps) {
  const { cn, fg, rainbow } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn('mb-4 break-inside-avoid px-5 py-5'),
    title: cn('text-lg leading-7', fg('title')),
    items: 'gap-3 mt-5 column',
    item: base.tocItem,
    articleTitle: base.articleTitle,
    line: cn(base.tocLine, rainbow(color, 'bgSoft')),
    itemIndex: cn('text-xs', rainbow(color, 'fg')),
  }
}
