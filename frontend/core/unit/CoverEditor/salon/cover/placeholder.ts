import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, bg, fill, primary } = useTwBelt()

  return {
    wrapper: cn(
      'align-both w-full h-full rounded border outline-none trans-all-100',
      `hover:${primary('border')}`,
      `focus-visible:${primary('border')}`,
      br('divider'),
      bg('card'),
    ),
    uploadIcon: cn('size-10 opacity-65', fill('text.digest')),
  }
}
