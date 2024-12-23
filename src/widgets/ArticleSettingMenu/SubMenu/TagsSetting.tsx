import { type FC, useState, useEffect } from 'react'
import { includes, reject, uniq, equals } from 'ramda'
import { useQuery, useMutation } from 'urql'

import type { TColorName, TID, TTag } from '~/spec'
import { toast, updateViewingArticle } from '~/signal'
// import { mockTags } from '~/mock'
import { THREAD } from '~/const/thread'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import useViewingArticle from '~/hooks/useViewingArticle'

import TagNode from '~/widgets/TagNode'
import Checker from '~/widgets/Checker'

import S from '../schema'
import Footer from './Footer'
import useTouched from '../useTouched'

import useSalon from '../styles/sub_menu/tags_setting'

type TProps = {
  onBack: () => void
}

const TagSetting: FC<TProps> = ({ onBack }) => {
  const s = useSalon()

  const [checked, setChecked] = useState([])
  const { touched, setTouched, resetTouched } = useTouched()

  const community = useViewingCommunity()
  const { article } = useViewingArticle()

  const [result] = useQuery({
    query: S.pagedArticleTags,
    variables: {
      filter: {
        community: community.slug,
        thread: THREAD.POST.toUpperCase(),
      },
    },
    requestPolicy: 'cache-and-network',
  })
  const [updatePostRes, updatePost] = useMutation(S.updatePost)

  const tags = result.data?.pagedArticleTags?.entries || []

  useEffect(() => {
    setChecked(article.articleTags.map((item) => item.id))
  }, [article.articleTags])

  const handleCheck = (id: TID, toggle: boolean): void => {
    const updated = toggle ? [...checked, id] : reject((_id) => _id === id, checked)

    setChecked(uniq(updated))
    setTouched(!equals(updated.sort(), article.articleTags.map((item) => item.id).sort()))
  }

  const handleUpdate = () => {
    const params = { id: article.id, articleTags: checked }
    updatePost(params).then((result) => {
      if (result.error) {
        toast('修改失败', 'error')
      } else {
        toast('修改完成')
        const newTags = result.data.updatePost.articleTags
        setChecked(newTags.map((item) => item.id))
        updateViewingArticle({ id: article.id, articleTags: newTags })
        resetTouched()
      }
    })
  }

  return (
    <div className={s.wrapper}>
      {tags.map((item: TTag) => (
        <div
          className={s.item}
          key={item.id}
          onClick={() => handleCheck(item.id, !includes(String(item.id), checked))}
        >
          <TagNode dotSize={2.5} color={item.color as TColorName} hashSize={3.5} />
          <div className={s.title}>{item.title}</div>
          <div className="grow" />
          <Checker size="small" checked={includes(item.id, checked)} />
        </div>
      ))}

      <Footer
        onBack={onBack}
        disabled={!touched}
        onConfirm={handleUpdate}
        top={10}
        loading={updatePostRes.fetching}
      />
    </div>
  )
}

export default TagSetting
