import type { FC } from 'react'

import InfoSVG from '~/icons/Info'

import useDocsEditor from '../../Editor/store/hooks'
import { DOC_INFO_MODAL } from '../constant'
import useSalon from '../salon/doc_info/panel'
import DocInfoAuthor from './Author'
import { formatDocInfoDate, formatDocInfoSlug, getDocInfoAuthorName } from './helper'
import DocInfoItem from './Item'

const DocInfoPanel: FC = () => {
  const s = useSalon()
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
        <h2 className={s.title}>{DOC_INFO_MODAL.TITLE}</h2>
      </div>

      <div className={s.grid}>
        <DocInfoItem label={DOC_INFO_MODAL.TITLE_LABEL} value={docDraftInfo.title} />
        <DocInfoItem
          label={DOC_INFO_MODAL.SLUG_LABEL}
          value={formatDocInfoSlug(docDraftInfo.slug)}
        />
        <DocInfoItem label={DOC_INFO_MODAL.DOCUMENT_ID_LABEL} value={docDraftInfo.id} />
        <DocInfoItem label={DOC_INFO_MODAL.WORD_COUNT_LABEL} value={docDraftInfo.wordCount} />
        <DocInfoItem
          label={DOC_INFO_MODAL.CREATION_DATE_LABEL}
          value={formatDocInfoDate(docDraftInfo.insertedAt)}
        />
        <DocInfoItem label={DOC_INFO_MODAL.CREATED_BY_LABEL} value={author} />
        <DocInfoItem
          label={DOC_INFO_MODAL.LAST_MODIFIED_LABEL}
          value={formatDocInfoDate(docDraftInfo.updatedAt)}
        />
        <DocInfoItem label={DOC_INFO_MODAL.LAST_MODIFIED_BY_LABEL} value={author} />
      </div>
    </div>
  )
}

export default DocInfoPanel
