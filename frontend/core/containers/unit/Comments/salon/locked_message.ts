import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, shadow, bg, fg, fill } = useTwBelt()

  return {
    wrapper: cn('relative row-center mb-4 p-4 pl-7 rounded', shadow('sm'), bg('sandBox')),
    lockIcon: cn('size-5 mr-2.5 -mt-1', fill('digest')),
    msg: cn('text-sm', fg('digest')),
  }
}
