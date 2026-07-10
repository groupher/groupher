import useArticle from '~/stores/article/hooks'
import FeedbackFooter from '~/unit/DocThread/FeedbackFooter'

import useSalon from './salon/content'

export default function Content() {
  const { doc } = useArticle()
  const s = useSalon()

  if (!doc) return null

  const html = doc.document?.html || doc.document?.bodyHtml || ''
  const fallback = doc.document?.markdown || doc.body || doc.digest || ''

  return (
    <div className={s.wrapper}>
      <div className={s.body}>
        {html ? (
          <div
            className={s.html}
            // oxlint-disable-next-line react/no-danger -- Public doc HTML is rendered from the backend content pipeline.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className={s.fallback}>{fallback || 'No content'}</p>
        )}
      </div>

      <FeedbackFooter top={16} offsetRight={0} />
    </div>
  )
}
