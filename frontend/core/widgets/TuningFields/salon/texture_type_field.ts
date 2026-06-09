import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, primary } = useTwBelt()
  const base = useBase()

  return {
    wrapper: base.wrapper,
    label: base.label,
    content: base.content,
    options: 'row-center gap-1.5',
    swatch: 'size-5 circle overflow-hidden relative border pointer trans-all-200 align-both',
    swatchIdle: cn(br('divider'), `hover:${br('digest')}`),
    swatchActive: cn(primary('border'), 'shadow-sm'),
  }
}
