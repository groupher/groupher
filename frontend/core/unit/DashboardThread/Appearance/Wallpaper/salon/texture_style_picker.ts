import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fg, primary } = useTwBelt()

  return {
    wrapper: 'flex items-center gap-3',
    label: cn('w-20 shrink-0 text-sm leading-none', fg('digest')),
    options: 'row-center gap-1.5',
    swatch: 'size-6 p-px circle overflow-hidden relative border pointer trans-all-200 align-both',
    swatchIdle: cn(br('divider'), `hover:${br('digest')}`),
    swatchActive: cn(primary('border'), 'shadow-sm'),
    swatchPreview: 's-full circle overflow-hidden',
  }
}
