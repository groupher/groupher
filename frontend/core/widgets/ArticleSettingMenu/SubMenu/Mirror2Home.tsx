import type { FC } from 'react'
import { useMutation } from 'urql'

import useViewingArticle from '~/hooks/useViewingArticle'
import { toast, updateViewingArticle } from '~/signal'

import S from '../schema'
import useTouched from '../useTouched'

import Footer from './Footer'
import useSalon from '../salon/sub_menu/mirror_home'

type TProps = {
  onBack: () => void
}

const Mirrow2Home: FC<TProps> = ({ onBack }) => {
  const s = useSalon()

  const { article } = useViewingArticle()
  const { resetTouched } = useTouched()
  const [result, updatePost] = useMutation(S.updatePost)

  const handleUpdate = () => {
    const params = {
      article: {
        innerId: article.innerId,
        community: article.communitySlug,
        thread: article.meta.thread,
      },
    }

    console.log('## ## handle action')
    updatePost(params).then((result) => {
      if (result.error) {
        toast('修改失败', 'error')
      } else {
        toast('修改完成')
        const newTitle = result.data.updatePost.title
        // setTitle(newTitle)
        updateViewingArticle({ id: article.id, title: newTitle })
        resetTouched()
      }
    })
  }
  return (
    <div className={s.wrapper}>
      <div className={s.note}>该操作会将当前帖子镜像到 Groupher 官方社区，</div>
      <div className={s.note}>请确保该帖子内容属于社区本身的功能请求/Bug/使用问题等。</div>
      <Footer onBack={onBack} top={10} loading={result.fetching} onConfirm={() => handleUpdate()} />
    </div>
  )
}

export default Mirrow2Home
