import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export { cn } from '~/css'

export default () => {
  const { cn, fg } = useTwBelt()
  const base = useBase()

  return {
    block: 'row-center row wrap relative w-full h-full',
    bar: cn(base.bar, 'h-1.5 w-20 opacity-40'),
    icon: 'size-2.5',
    faqTitle: cn('text-xs absolute -ml-1', fg('text.title')),
    list: 'row-center row wrap w-full h-36 gap-x-1.5 mt-20',
    box: cn(base.box, 'border-none w-20 h-16'),
  }
}
