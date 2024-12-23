import { type FC, useState, useEffect } from 'react'
import { useMutation } from 'urql'

import useViewingArticle from '~/hooks/useViewingArticle'
import { toast, updateViewingArticle } from '~/signal'

import S from '../schema'
import useTouched from '../useTouched'

import Footer from './Footer'
import { Wrapper, Inputer, Note } from '../styles/sub_menu/title_setting'

type TProps = {
  onBack: () => void
}

const TitleSetting: FC<TProps> = ({ onBack }) => {
  const { article } = useViewingArticle()
  const [title, setTitle] = useState(article.title)
  const { touched, setTouched, resetTouched } = useTouched()
  const [result, updatePost] = useMutation(S.updatePost)

  useEffect(() => {
    setTitle(article.title)
  }, [])

  const handleUpdate = () => {
    const params = { id: article.id, title }
    updatePost(params).then((result) => {
      if (result.error) {
        toast('修改失败', 'error')
      } else {
        toast('修改完成')
        const newTitle = result.data.updatePost.title
        setTitle(newTitle)
        updateViewingArticle({ id: article.id, title: newTitle })
        resetTouched()
      }
    })
  }

  return (
    <Wrapper>
      <Inputer
        autoFocus
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          setTouched(e.target.value !== article.title)
        }}
      />
      <Note>修改记录会显示在下方日志中。管理员仅能修改标题，帖子作者仅能修改内容。</Note>
      <Footer
        onBack={onBack}
        disabled={!touched}
        top={10}
        loading={result.fetching}
        onConfirm={() => handleUpdate()}
      />
    </Wrapper>
  )
}

export default TitleSetting
