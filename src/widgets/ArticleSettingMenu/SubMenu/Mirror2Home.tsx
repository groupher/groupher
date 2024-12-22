import type { FC } from 'react'
import { useMutation } from 'urql'

import useViewingArticle from '~/hooks/useViewingArticle'
import { toast, updateViewingArticle } from '~/signal'

import S from '../schema'
import useTouched from '../useTouched'

import Footer from './Footer'
import { Wrapper, Note } from '../styles/sub_menu/mirror_home'

type TProps = {
  onBack: () => void
}

const Mirrow2Home: FC<TProps> = ({ onBack }) => {
  const { article } = useViewingArticle()
  const { resetTouched } = useTouched()
  const [result, updatePost] = useMutation(S.updatePost)

  const handleUpdate = () => {
    const params = { id: article.id }
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
    <Wrapper>
      <Note>该操作会将当前帖子镜像到 Groupher 官方社区，</Note>
      <Note>请确保该帖子内容属于社区本身的功能请求/Bug/使用问题等。</Note>
      <Footer
        onBack={onBack}
        top={12}
        bottom={2}
        loading={result.fetching}
        onConfirm={() => handleUpdate()}
      />
    </Wrapper>
  )
}

export default Mirrow2Home
