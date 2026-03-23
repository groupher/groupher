import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

// Config-page: http://danilowoz.com/create-react-content-loader/
export default function useSalon({ ...spacing }: TProps) {
  const { cn, margin } = useTwBelt()

  return {
    wrapper: cn('', margin(spacing)),
    inner: 'w-full overflow-hidden',
  }
}
