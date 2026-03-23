import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, cnMerge, fg } = useTwBelt()
  const base = useBase()

  return {
    block: 'row-center row wrap relative s-full',
    bar: cnMerge(base.bar, 'h-1.5 w-20 opacity-40'),
    icon: 'size-2.5',
    faqTitle: cn('text-xs absolute -ml-1', fg('title')),
    list: 'row-center row wrap w-full h-36 gap-x-1.5 mt-16',
    box: cnMerge(base.box, 'border-none w-20 h-16'),
  }
}
