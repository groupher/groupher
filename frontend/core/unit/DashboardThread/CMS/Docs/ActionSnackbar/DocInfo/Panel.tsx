import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import InfoSVG from '~/icons/Info'

import useDocsEditor from '../../Editor/store/hooks'
import { DOC_INFO_LABEL_KEY } from '../constant'
import useSalon from '../salon/doc_info/panel'
import DocInfoAuthor from './Author'
import { formatDocInfoDate, formatDocInfoSlug, getDocInfoAuthorName } from './helper'
import DocInfoItem from './Item'
import DocInfoVisibility from './Visibility'

const DocInfoPanel: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const { docDraftInfo } = useDocsEditor()
  const authorName = getDocInfoAuthorName(docDraftInfo.author)
  const author = authorName ? (
    <DocInfoAuthor author={docDraftInfo.author} name={authorName} />
  ) : null

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.iconBox}>
          <InfoSVG className={s.icon} />
        </div>
        <h2 className={s.title}>{t(DOC_INFO_LABEL_KEY.TITLE)}</h2>
      </div>

      <div className={s.grid}>
        <DocInfoItem
          label={t(DOC_INFO_LABEL_KEY.VISIBILITY_LABEL)}
          value={docDraftInfo.id ? <DocInfoVisibility state={docDraftInfo.publishState} /> : null}
        />
        <DocInfoItem label={t(DOC_INFO_LABEL_KEY.TITLE_LABEL)} value={docDraftInfo.title} />
        <DocInfoItem
          label={t(DOC_INFO_LABEL_KEY.SLUG_LABEL)}
          value={formatDocInfoSlug(docDraftInfo.slug)}
        />
        <DocInfoItem label={t(DOC_INFO_LABEL_KEY.DOCUMENT_ID_LABEL)} value={docDraftInfo.id} />
        <DocInfoItem
          label={t(DOC_INFO_LABEL_KEY.WORD_COUNT_LABEL)}
          value={docDraftInfo.wordCount}
        />
        <DocInfoItem
          label={t(DOC_INFO_LABEL_KEY.CREATION_DATE_LABEL)}
          value={formatDocInfoDate(docDraftInfo.insertedAt)}
        />
        <DocInfoItem label={t(DOC_INFO_LABEL_KEY.CREATED_BY_LABEL)} value={author} />
        <DocInfoItem
          label={t(DOC_INFO_LABEL_KEY.LAST_MODIFIED_LABEL)}
          value={formatDocInfoDate(docDraftInfo.updatedAt)}
        />
        <DocInfoItem label={t(DOC_INFO_LABEL_KEY.LAST_MODIFIED_BY_LABEL)} value={author} />
      </div>
    </div>
  )
}

export default DocInfoPanel
