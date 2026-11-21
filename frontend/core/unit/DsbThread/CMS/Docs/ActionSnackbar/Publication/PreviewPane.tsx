import type { FC, MouseEvent } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TDocCoverLayout } from '~/spec'
import DocCovers from '~/unit/DocCovers'

import ContentView from './ContentView'
import Navigation from './Navigation'
import PreviewFAQ from './PreviewFAQ'
import { projectPreviewCover } from './previewModel'
import useSalon from './salon'
import type { Preview } from './types'

const PreviewPane: FC<{ data: Preview; onSelect: (id: string) => void }> = ({ data, onSelect }) => {
  const s = useSalon()
  const { t } = useTrans()
  const navigate = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as Element).closest('a')
    if (!link) return
    const href = link.getAttribute('href') ?? ''
    let id: string | undefined
    try {
      const url = new URL(href, window.location.origin)
      id = href.startsWith('#docs-preview/')
        ? href.slice('#docs-preview/'.length)
        : url.origin === window.location.origin
          ? data.presentation.links?.[url.pathname]
          : undefined
    } catch {
      return
    }
    if (id && data.nodes.some((node) => node.doc_id === id)) {
      event.preventDefault()
      event.stopPropagation()
      onSelect(id)
    }
  }
  const settings = data.presentation.settings as {
    layout?: { doc_cover_layout?: TDocCoverLayout }
    doc_faq?: Parameters<typeof PreviewFAQ>[0]['value']
    enable?: { doc_faq?: boolean }
  }
  return (
    <div className={s.wrapper} onClickCapture={navigate}>
      <nav aria-label={t('dsb.doc.publication.preview')}>
        <Navigation nodes={data.nodes} onSelect={onSelect} />
      </nav>
      <DocCovers
        layout={settings.layout?.doc_cover_layout ?? 'STACK_CARDS'}
        data={projectPreviewCover(data)}
      />
      <ContentView content={data.page} />
      {settings.enable?.doc_faq !== false && <PreviewFAQ value={settings.doc_faq} />}
    </div>
  )
}
export default PreviewPane
