import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = TSpace

// Config-page: http://danilowoz.com/create-react-content-loader/
export default ({ ...spacing }: TProps) => {
  const { cn, margin } = useTwBelt()

  return {
    wrapper: cn('', margin(spacing)),
    inner: 'w-full overflow-hidden',
  }
}
