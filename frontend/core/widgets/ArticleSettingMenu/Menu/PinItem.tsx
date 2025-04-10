import { useCallback, useEffect, useState } from 'react'
import { useMutation } from 'urql'

import { toast, updateViewingArticle } from '~/signal'
import useViewingArticle from '~/hooks/useViewingArticle'

import PinSVG from '~/icons/Pin'
import UnPinSVG from '~/icons/UnPin'
import SpinSVG from '~/icons/Spin'

import S from '../schema'
import useSalon from '../salon/menu'

export default () => {
  const s = useSalon()

  const { article } = useViewingArticle()
  const [result, pinPost] = useMutation(S.pinPost)
  const [_result2, undoPinPost] = useMutation(S.undoPinPost)

  const [pin, setPin] = useState(article.isPinned)

  useEffect(() => {
    setPin(article.isPinned)
  }, [])

  const handlePin = useCallback(() => {
    const action = !pin
      ? pinPost({ id: article.id, communityId: article.community.id })
      : undoPinPost({ id: article.id, communityId: article.community.id })

    action.then((result) => {
      if (result.error) {
        toast('设置失败', 'error')
      } else {
        toast('设置完成')
        setPin(!pin)
        updateViewingArticle({ id: article.id, isPinned: !pin })
      }
    })
  }, [pin, article, pinPost, undoPinPost])

  return (
    <div className={s.menuItem} onClick={handlePin}>
      {pin ? <UnPinSVG className={s.icon} /> : <PinSVG className={s.icon} />}
      {pin ? '取消置顶' : '置顶'}
      <div className="grow" />
      {result.fetching && <SpinSVG className={s.icon} />}
    </div>
  )
}
