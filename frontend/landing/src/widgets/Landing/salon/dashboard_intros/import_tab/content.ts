import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, shadow } = useTwBelt()

  return {
    wrapper: cn('w-44 h-40 px-6 py-4 -mt-2.5 rounded-md relative z-30', bg('card'), shadow('md')),
    head: 'row-center',
    logo: cn('size-6', shadow('sm')),
    title: cn('text-lg ml-2', fg('title')),
    //
    bar: cn('w-32 h-2 opacity-15 rounded-md mb-3', bg('digest')),
  }
}
