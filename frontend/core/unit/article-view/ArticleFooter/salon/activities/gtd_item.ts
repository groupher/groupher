import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export default function useSalon() {
  const { cn, fill } = useTwBelt()
  const base = useBase()

  return {
    wrapper: '',
    item: base.item,
    tail: base.tail,
    content: base.content,
    highlight: base.highlight,
    icon: cn('size-3.5 opacity-65 mr-2.5', fill('digest')),
  }
}
