import useTwBelt from '~/hooks/useTwBelt'
import { getInfoPanelHeight } from '../metric'

type TProps = {
  type: string
}

export default ({ type }: TProps) => {
  const { cn, bg, fg } = useTwBelt()

  return {
    wrapper: cn(
      'px-10 py-5 w-full',
      'rounded-bl-[10px] rounded-br-[10px]',
      'trans-all-100',
      bg('modal.subPanel'),
      fg('title'),
      getInfoPanelHeight(type),
    ),
  }
}
