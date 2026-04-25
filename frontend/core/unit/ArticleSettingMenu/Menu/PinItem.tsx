import { useCallback, useEffect, useState } from 'react'
import { useMutation } from 'urql'
import PinSVG from '~/icons/Pin'
import SpinSVG from '~/icons/Spin'
import UnPinSVG from '~/icons/UnPin'
import { toast, updateViewingArticle } from '~/signal'
import useArticle from '~/stores/article/hooks'
import useSalon from '../salon/menu'
import S from '../schema'

export default function PinItem() {
  const s = useSalon()

  const { article } = useArticle()
  const [result, pinPost] = useMutation(S.pinPost)
  const [_result2, undoPinPost] = useMutation(S.undoPinPost)

  const [pin, setPin] = useState(article.isPinned)

  useEffect(() => {
    setPin(article.isPinned)
  }, [article.isPinned])

  const handlePin = useCallback(() => {
    const articleRef = {
      innerId: article.innerId,
      community: article.communitySlug,
      thread: article.meta.thread,
    }

    const action = !pin ? pinPost({ article: articleRef }) : undoPinPost({ article: articleRef })

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
    <button type='button' className={s.menuItem} onClick={handlePin}>
      {pin ? <UnPinSVG className={s.icon} /> : <PinSVG className={s.icon} />}
      {pin ? '取消置顶' : '置顶'}
      <div className='grow' />
      {result.fetching && <SpinSVG className={s.icon} />}
    </button>
  )
}
