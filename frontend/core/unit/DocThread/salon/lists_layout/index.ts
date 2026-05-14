import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default function useSalon() {
  const { cn } = useTwBelt()
  const { main } = useBase()

  return {
    wrapper: 'column-align-both w-full mt-2.5 pl-8',
    cats: cn(main, 'column-align-both'),
  }
}
