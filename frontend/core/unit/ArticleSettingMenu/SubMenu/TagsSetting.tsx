import { useQuery } from '@tanstack/react-query'
import { equals, includes, reject, uniq } from 'ramda'
import { type FC, useEffect, useState } from 'react'

// import { mockTags } from '~/mock'
import { THREAD } from '~/const/thread'
import { browserGraphQLRequest } from '~/graphql/client'
import useViewingArticle from '~/hooks/useViewingArticle'
import { Q } from '~/query'
import { viewerQueryKeys } from '~/query/key'
import useArticleSettingMutation from '~/query/mutation/useArticleSettingMutation'
import type { TColorName, TID, TTag } from '~/spec'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import Checker from '~/ui/Checker'
import TagNode from '~/ui/TagNode'
import { toast } from '~/ui/Toaster'

import { isWorkingCopyRevisionConflict } from '../helper'
import S from '../schema'
import useTouched from '../useTouched'
import Footer from './Footer'
import useSalon from './salon/tags_setting'

type TProps = {
  onBack: () => void
}

const TagSetting: FC<TProps> = ({ onBack }) => {
  const s = useSalon()
  const { accountScope } = useAccount()

  const [checked, setChecked] = useState<TID[]>([])
  const [revisionConflict, setRevisionConflict] = useState(false)
  const { touched, setTouched, resetTouched } = useTouched()

  const { slug: community } = useCommunity()
  const { article, articlePath } = useViewingArticle()

  const result = useQuery(Q.article.tagGroups(community, THREAD.POST))
  const workingCopiesQuery = useQuery({
    queryKey: viewerQueryKeys.articleWorkingCopies(
      accountScope || 'anonymous',
      String(article.id ?? ''),
      community,
    ),
    enabled: Boolean(accountScope && article.id && community),
    queryFn: () => {
      if (!article.id || !community) throw new Error('Article identity is unavailable.')
      return browserGraphQLRequest(S.articleWorkingCopies, {
        articleId: article.id,
        community,
      })
    },
  })
  const workingCopy = workingCopiesQuery.data?.articleWorkingCopies?.find(
    (candidate) => candidate.scopeType === 'default',
  )
  const [saveResult, saveWorkingCopy] = useArticleSettingMutation(S.saveWorkingCopy)

  const tags = (result.data?.flatMap((group) => group.tags) || []) as unknown as TTag[]
  const latestTagTitles = tags
    .filter((tag) => tag.id !== undefined && workingCopy?.tagIds?.includes(tag.id as TID))
    .map((tag) => tag.title)
    .join('、')

  useEffect(() => {
    setChecked([])
    resetTouched()
    setRevisionConflict(false)
  }, [accountScope, article.id])

  useEffect(() => {
    if (!touched) setChecked((workingCopy?.tagIds || []) as TID[])
  }, [touched, workingCopy?.tagIds])

  const handleCheck = (id: TID, toggle: boolean): void => {
    const checkedIds = checked || []
    const updated = toggle ? [...checkedIds, id] : reject((_id) => _id === id, checkedIds)

    setChecked(uniq(updated))
    setTouched(!equals([...updated].sort(), ([...(workingCopy?.tagIds || [])] as TID[]).sort()))
  }

  const handleUpdate = async () => {
    if (!article.id || !community || !workingCopy || !articlePath) {
      toast('文章信息不完整', 'error')
      return
    }

    const result = await saveWorkingCopy({
      _articlePath: articlePath,
      articleId: article.id,
      community,
      revision: workingCopy.revision,
      tagIds: checked,
      workingCopyId: workingCopy.id,
    })

    if (result.error || !result.data?.saveWorkingCopy) {
      if (isWorkingCopyRevisionConflict(result.error)) {
        setRevisionConflict(true)
        await workingCopiesQuery.refetch()
        toast('检测到协作者已保存新版本。你的标签修改已保留，请核对后再保存。', 'error')
      } else {
        toast('编辑副本标签保存失败，请重新加载后重试', 'error')
      }
      return
    }

    toast('标签已保存到默认编辑副本；公开版本未变')
    setRevisionConflict(false)
    await workingCopiesQuery.refetch()
    resetTouched()
  }

  return (
    <div className={s.wrapper}>
      {tags.map((item: TTag) => (
        <button
          type='button'
          className={s.item}
          key={item.id}
          disabled={!workingCopy || workingCopiesQuery.isFetching}
          onClick={() => item.id !== undefined && handleCheck(item.id, !includes(item.id, checked))}
        >
          <TagNode
            dotSize={2.5}
            color={item.color as TColorName}
            marker={item.marker}
            hashSize={3.5}
            iconSize={3.5}
          />
          <div className={s.title}>{item.title}</div>
          <div className='grow' />
          <Checker size='small' checked={includes(item.id, checked)} />
        </button>
      ))}

      {revisionConflict ? (
        <div role='alert' className='text-digest mt-2 text-xs'>
          最新服务端标签：{latestTagTitles || '无'}。本地未保存选择仍保留；请核对差异后再确认保存。
        </div>
      ) : null}

      <Footer
        onBack={onBack}
        disabled={!touched || !workingCopy || workingCopiesQuery.isFetching}
        onConfirm={handleUpdate}
        top={10}
        loading={saveResult.fetching || workingCopiesQuery.isFetching}
      />
    </div>
  )
}

export default TagSetting
