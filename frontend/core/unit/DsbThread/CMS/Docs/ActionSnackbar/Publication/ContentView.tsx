import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'

import useSalon from './salon'
import type { Content } from './types'

const ContentView: FC<{ content: Content | null }> = ({ content }) => {
  const s = useSalon()
  const { t } = useTrans()
  if (!content) return <p>{t('dsb.doc.publication.no_content')}</p>
  return (
    <article className={s.panel}>
      {(content.cover_url || content.cover_url_dark) && (
        <>
          <img
            className={s.lightImage}
            src={content.cover_url || content.cover_url_dark || undefined}
            alt=''
          />
          <img
            className={s.darkImage}
            src={content.cover_url_dark || content.cover_url || undefined}
            alt=''
          />
        </>
      )}
      <h2 className={s.title}>{content.title}</h2>
      {content.subtitle && <p>{content.subtitle}</p>}
      {/* Trusted persisted HTML produced by Content Publisher, never browser-authored HTML. */}
      <div
        className={s.article}
        // oxlint-disable-next-line react/no-danger -- Saved BodyBag HTML comes from the trusted content converter.
        dangerouslySetInnerHTML={{ __html: content.body.html || '' }}
      />
    </article>
  )
}
export default ContentView
