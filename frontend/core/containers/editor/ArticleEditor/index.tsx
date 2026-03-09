/*
 * ArticleEditor
 */

import { type FC, useEffect } from 'react'
import METRIC from '~/const/metric'
import { CONDITION_MODE } from '~/const/mode'
import type { TEditMode, TMetric } from '~/spec'
import ArchiveAlert from '~/widgets/ArchiveAlert'
import ConditionSelector from '~/widgets/ConditionSelector'
import NoticeBar from '~/widgets/NoticeBar'
import TagSelector from '~/widgets/TagSelector'

import ArticleCover from './ArticleCover'
import Footer from './Footer'
import useSalon from './salon'
import TitleInput from './TitleInput'
// import Settings from './Settings'
import useLogic from './useLogic'

type TProps = {
  metric?: TMetric
}

const ArticleEditor: FC<TProps> = ({ metric = METRIC.ARTICLE_EDITOR }) => {
  const s = useSalon()

  const {
    isArchived,
    archivedAt,
    mode,
    submitState,
    getGroupedTags,
    getEditData,
    allowEdit,
    activeCat,
    activeTag,
    onTagSelect,
    catOnChange,
    loadArticle,
    loadCommunity,
  } = useLogic()

  useEffect(() => {
    loadCommunity()
  }, [])

  useEffect(() => {
    if (mode === 'update') loadArticle()
  }, [mode])

  const groupedTags = getGroupedTags()
  const editData = getEditData()
  // const { title, body } = editData
  const { title } = editData

  const texts = {
    holder: {
      title: '// 帖子标题',
    },
  }
  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        {!allowEdit && <NoticeBar type='notice' content='只有作者可以编辑本内容。' left={5} />}
        {isArchived && <ArchiveAlert date={archivedAt} top={3} bottom={4} left={5} />}

        <ArticleCover />
        <TitleInput title={title} placeholder={texts.holder.title} />
        <div className={s.funcRow}>
          <ConditionSelector
            mode={CONDITION_MODE.CAT}
            closable={false}
            selected
            active={activeCat}
            onSelect={catOnChange}
            right={4}
          />
          <TagSelector groupedTags={groupedTags} activeTag={activeTag} onSelect={onTagSelect} />
        </div>
        <Footer mode={mode as TEditMode} editData={editData} submitState={submitState} />
      </div>
    </div>
  )
}

export default ArticleEditor
