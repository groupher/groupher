import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export { cn } from '~/css'

export default () => {
  const { cn } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(base.main, 'column-align-both'),
    active: base.mainActive,
  }
}
