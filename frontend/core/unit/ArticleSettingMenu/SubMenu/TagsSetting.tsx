import { equals, includes, reject, uniq } from 'ramda'
import { type FC, useEffect, useState } from 'react'
import { useMutation, useQuery } from 'urql'

// import { mockTags } from '~/mock'
import { THREAD } from '~/const/thread'
import useViewingArticle from '~/hooks/useViewingArticle'
import { toast, updateViewingArticle } from '~/signal'
import type { TColorName, TID, TTag, TTagGroup } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import Checker from '~/widgets/Checker'
import TagNode from '~/widgets/TagNode'

import S from '../schema'
import useTouched from '../useTouched'
import Footer from './Footer'
import useSalon from './salon/tags_setting'

type TProps = {
  onBack: () => void
}

const TagSetting: FC<TProps> = ({ onBack }) => {
  const s = useSalon()

  const [checked, setChecked] = useState([])
  const { touched, setTouched, resetTouched } = useTouched()

  const { slug: community } = useCommunity()
  const { article } = useViewingArticle()

  const [result] = useQuery({
    query: S.communityTagGroups,
    variables: {
      community,
      thread: THREAD.POST,
    },
    requestPolicy: 'cache-and-network',
  })
  const [updatePostRes, updatePost] = useMutation(S.updatePost)

  const tags = result.data?.communityTagGroups?.flatMap((group: TTagGroup) => group.tags) || []

  useEffect(() => {
    const originTags = article.communityTags || []
    setChecked(originTags.map((item) => item.id))
  }, [article.communityTags])

  const handleCheck = (id: TID, toggle: boolean): void => {
    const checkedIds = checked || []
    const updated = toggle ? [...checkedIds, id] : reject((_id) => _id === id, checkedIds)

    const originTags = article.communityTags || []

    setChecked(uniq(updated))
    setTouched(!equals(updated.sort(), originTags.map((item) => item.id).sort()))
  }

  const handleUpdate = () => {
    const params = {
      article: {
        innerId: article.innerId,
        community: article.communitySlug,
        thread: article.meta.thread,
      },
      communityTags: checked,
    }

    updatePost(params).then((res) => {
      if (res.error) {
        toast('修改失败', 'error')
      } else {
        toast('修改完成')
        const newTags = res.data.updatePost.communityTags
        setChecked(newTags.map((item) => item.id))
        updateViewingArticle({ id: article.id, communityTags: newTags })
        resetTouched()
      }
    })
  }

  return (
    <div className={s.wrapper}>
      {tags.map((item: TTag) => (
        <button
          type='button'
          className={s.item}
          key={item.id}
          onClick={() => handleCheck(item.id, !includes(String(item.id), checked))}
        >
          <TagNode dotSize={2.5} color={item.color as TColorName} hashSize={3.5} />
          <div className={s.title}>{item.title}</div>
          <div className='grow' />
          <Checker size='small' checked={includes(item.id, checked)} />
        </button>
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
