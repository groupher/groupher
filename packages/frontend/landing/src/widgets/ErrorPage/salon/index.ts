// import PromptIcon from '~/widgets/PromptIcon'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('w-screen h-screen align-both'),
  }
}
