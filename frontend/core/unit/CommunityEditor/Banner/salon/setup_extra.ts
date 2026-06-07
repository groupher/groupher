import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { isLightTheme } = useTheme()
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('column-align-both relative w-96 mt-10', fg('digest')),
    head: 'row-center mb-2 gap-x-1.5',
    applyIcon: cn('size-5 opacity-80', fill('digest')),
    introTitle: cn('text-xl', fg('title')),
    introdesc: cn('text-sm mb-10 opacity-80', fg('digest')),
    input: 'w-full text-sm pl-2.5 placeholder:text-sm',
    //
    info: 'mb-9',
    label: cn('text-sm ml-px mb-2.5 bold-sm', fg('digest')),
    nextBtn: 'align-both w-52 -ml-6',
    prevBtn: cn('saturate-0', isLightTheme && 'opacity-80'),
  }
}
