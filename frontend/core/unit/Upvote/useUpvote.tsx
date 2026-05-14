import { useCallback, useState } from 'react'

import { authWarn } from '~/signal'
import useAccount from '~/stores/account/hooks'

type TProps = {
  viewerHasUpvoted: boolean
  onAction?: (viewerHasUpvoted: boolean) => void
}

type TRet = {
  handleUpvote: () => void
  startAnimate: boolean
}

const useUpvote = ({ viewerHasUpvoted, onAction }: TProps): TRet => {
  const { isLogin } = useAccount()
  const [startAnimate, setStartAnimate] = useState(false)

  const handleUpvote = useCallback(() => {
    if (!isLogin) return authWarn()
    setStartAnimate(true)
    setTimeout(() => setStartAnimate(false), 500)

    onAction(!viewerHasUpvoted)
  }, [viewerHasUpvoted, onAction, isLogin])

  return {
    handleUpvote,
    startAnimate,
  }
}

export default useUpvote
