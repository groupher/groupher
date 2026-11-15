import { useQuery } from '@tanstack/react-query'
import { type FC, useEffect, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useViewingArticle from '~/hooks/useViewingArticle'
import Input from '~/ui/Input'
import { toast } from '~/ui/Toaster'

import S from '../schema'
import useTouched from '../useTouched'
import Footer from './Footer'
import useSalon from './salon/title_setting'

type TProps = {
  onBack: () => void
}

const TitleSetting: FC<TProps> = ({ onBack }) => {
  const s = useSalon()

  const { article, articlePath } = useViewingArticle()
  const [title, setTitle] = useState(article.title ?? '')
  const { touched, setTouched, resetTouched } = useTouched()
  const workingCopiesQuery = useQuery({
    queryKey: ['article-working-copies', article.id, articlePath?.community],
    enabled: Boolean(article.id && articlePath?.community),
    queryFn: () => {
      if (!article.id || !articlePath?.community)
        throw new Error('Article identity is unavailable.')
      return browserGraphQLRequest(S.articleWorkingCopies, {
        articleId: article.id,
        community: articlePath.community,
      })
    },
  })
  const workingCopy = workingCopiesQuery.data?.articleWorkingCopies?.find(
    (candidate) => candidate.scopeType === 'default',
  )
  const [result, saveWorkingCopy] = useArticleSettingMutation(S.saveWorkingCopy)

  useEffect(() => {
    if (workingCopy && !touched) setTitle(workingCopy.title)
  }, [touched, workingCopy?.title, workingCopy?.revision])

  const handleUpdate = () => {
    if (!article.id || !articlePath?.community || !workingCopy) {
      toast('默认编辑副本尚未加载', 'error')
      return
    }

    const params = {
      _articlePath: articlePath,
      articleId: article.id,
      community: articlePath.community,
      revision: workingCopy.revision,
      title,
      workingCopyId: workingCopy.id,
    }

    saveWorkingCopy(params).then(async (result) => {
      if (result.error) {
        toast('修改失败', 'error')
      } else if (result.data?.saveWorkingCopy?.title !== undefined) {
        toast('已保存到默认编辑副本；公开版本未变')
        const newTitle = result.data.saveWorkingCopy.title
        setTitle(newTitle)
        await workingCopiesQuery.refetch()
        resetTouched()
      }
    })
  }

  return (
    <div className={s.wrapper}>
      <Input
        className={s.input}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          setTouched(e.target.value !== workingCopy?.title)
        }}
      />
      <div className={s.note}>
        标题保存到默认编辑副本；公开版本保持不变，需发布新 Snapshot 后才会更新。
      </div>
      <Footer
        onBack={onBack}
        disabled={!touched || !workingCopy}
        top={10}
        loading={result.fetching}
        onConfirm={() => handleUpdate()}
      />
    </div>
  )
}

export default TitleSetting
import useArticleSettingMutation from '~/query/mutation/useArticleSettingMutation'
