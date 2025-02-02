import { useState, useCallback } from 'react'

import { authWarn } from '~/signal'
import useAccount from '~/hooks/useAccount'

type TProps = {
  viewerHasUpvoted: boolean
  onAction?: (viewerHasUpvoted: boolean) => void
}

type TRet = {
  handleClick: () => void
  startAnimate: boolean
}

const useUpvote = ({ viewerHasUpvoted, onAction }: TProps): TRet => {
  const { isLogin } = useAccount()
  const [startAnimate, setStartAnimate] = useState(false)

  const handleClick = useCallback(() => {
    if (!isLogin) return authWarn()
    setStartAnimate(true)
    setTimeout(() => setStartAnimate(false), 500)

    onAction(!viewerHasUpvoted)
  }, [viewerHasUpvoted, onAction, isLogin])

  return {
    handleClick,
    startAnimate,
  }
}

export default useUpvote
