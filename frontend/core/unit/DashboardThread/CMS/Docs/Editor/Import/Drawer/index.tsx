import type {
  TCursorRef,
  TLocation,
  TRichEditorHandle,
  TRichEditorOutlineItem,
  TRichEditorValue,
} from '@groupher/rich-editor'
import { domAnimation, LazyMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type FC } from 'react'

import TYPE from '~/const/type'
import useTrans from '~/hooks/useTrans'
import ArrowSimpleSVG from '~/icons/ArrowSimple'
import CloseLightSVG from '~/icons/CloseLight'
import FileTextSVG from '~/icons/FileText'
import LinkSVG from '~/icons/Link'
import GoogleSVG from '~/icons/social/Google'
import NotionSVG from '~/icons/social/Notion'
import {
  importDocument,
  importDocumentationPlatform,
  type TDocumentImportResult,
} from '~/lib/documentImport'
import BaseDrawer from '~/ui/Drawer'
import { toast } from '~/ui/Toaster'

import InsertAction from './InsertAction'
import LocalFilePicker from './LocalFilePicker'
import PlatformUrlPicker from './PlatformUrlPicker'
import ReviewEditor from './ReviewEditor'
import useSalon from './salon'
import SourceCard from './SourceCard'
import type { TImportSource, TImportTarget } from './spec'

type TProps = {
  cursor: TCursorRef | null
  editor: TRichEditorHandle | null
  show: boolean
  targetDocId: string | null
  onClose: () => void
  onInserted: () => void
}

const ImportDrawer: FC<TProps> = ({ cursor, editor, show, targetDocId, onClose, onInserted }) => {
  const s = useSalon()
  const { t } = useTrans()
  const outlineRef = useRef<TRichEditorOutlineItem[]>([])
  const [source, setSource] = useState<TImportSource | null>(null)
  const [result, setResult] = useState<TDocumentImportResult | null>(null)
  const [reviewValue, setReviewValue] = useState<TRichEditorValue | null>(null)
  const [reviewRevision, setReviewRevision] = useState(0)
  const [pending, setPending] = useState(false)
  const [inserting, setInserting] = useState(false)
  const [error, setError] = useState('')
  const [target, setTarget] = useState<TImportTarget>('document-end')
  const [outline, setOutline] = useState<TRichEditorOutlineItem[]>([])
  const [sectionKey, setSectionKey] = useState('')
  const [cursorExpired, setCursorExpired] = useState(false)

  const toggleSource = (nextSource: TImportSource): void => {
    setSource((currentSource) => (currentSource === nextSource ? null : nextSource))
  }

  const releaseOutline = useCallback(() => {
    for (const item of outlineRef.current) item.block.release()
    outlineRef.current = []
    setOutline([])
    setSectionKey('')
  }, [])

  const readOutline = useCallback(() => {
    releaseOutline()
    const nextOutline = editor?.getOutline() ?? []
    outlineRef.current = nextOutline
    setOutline(nextOutline)
    setSectionKey(nextOutline[0]?.key ?? '')
  }, [editor, releaseOutline])

  const reset = useCallback(() => {
    releaseOutline()
    setSource(null)
    setResult(null)
    setReviewValue(null)
    setPending(false)
    setInserting(false)
    setError('')
    setTarget('document-end')
    setCursorExpired(false)
  }, [releaseOutline])

  useEffect(() => {
    if (!show) reset()
  }, [reset, show])

  useEffect(() => releaseOutline, [releaseOutline])

  const handleSelectFile = async (file: File): Promise<void> => {
    setPending(true)
    setError('')

    try {
      const nextResult = await importDocument(file)
      setResult(nextResult)
      setReviewValue(nextResult.value)
      setReviewRevision((revision) => revision + 1)
      readOutline()
    } catch (cause) {
      setResult(null)
      setError(cause instanceof Error ? cause.message : t('dsb.doc.import.failed'))
    } finally {
      setPending(false)
    }
  }

  const handlePlatformUrl = async (url: string): Promise<void> => {
    setPending(true)
    setError('')

    try {
      const nextResult = await importDocumentationPlatform(url)
      setResult(nextResult)
      setReviewValue(nextResult.value)
      setReviewRevision((revision) => revision + 1)
      readOutline()
    } catch (cause) {
      setResult(null)
      setError(cause instanceof Error ? cause.message : t('dsb.doc.import.failed'))
    } finally {
      setPending(false)
    }
  }

  const resolveLocation = (): TLocation | null => {
    switch (target) {
      case 'document-start':
        return { type: 'document', position: 'start' }
      case 'document-end':
        return { type: 'document', position: 'end' }
      case 'saved-cursor':
        return cursor && !cursorExpired ? { type: 'cursor', cursor } : null
      case 'section-end': {
        const sectionIndex = outline.findIndex((item) => item.key === sectionKey)
        if (sectionIndex === -1) return null

        const section = outline[sectionIndex]
        const nextBoundary = outline
          .slice(sectionIndex + 1)
          .find((item) => item.level <= section.level)

        return nextBoundary
          ? { type: 'block', block: nextBoundary.block, position: 'before' }
          : { type: 'document', position: 'end' }
      }
    }
  }

  const handleInsert = (): void => {
    if (!reviewValue || !editor || !targetDocId || inserting) return

    const location = resolveLocation()
    if (!location) {
      setError(t('dsb.doc.import.location_unavailable'))
      return
    }

    setInserting(true)
    setError('')
    const commandResult = editor.insertContent(reviewValue, location)

    if (commandResult.ok) {
      toast(t('dsb.doc.import.inserted'), 'success')
      onInserted()
      return
    }

    if (!('reason' in commandResult)) return

    if (commandResult.reason === 'location-expired') {
      if (target === 'saved-cursor') setCursorExpired(true)
      if (target === 'section-end') readOutline()
      setError(t('dsb.doc.import.location_expired'))
    } else if (commandResult.reason === 'location-unavailable') {
      setError(t('dsb.doc.import.location_unavailable'))
    } else if (commandResult.reason === 'empty-content') {
      setError(t('dsb.doc.import.empty_content'))
    } else {
      setError(t('dsb.doc.import.invalid_content'))
    }

    setInserting(false)
  }

  const insertLabel =
    target === 'document-start'
      ? t('dsb.doc.import.insert.start')
      : target === 'saved-cursor'
        ? t('dsb.doc.import.insert.cursor')
        : target === 'section-end'
          ? t('dsb.doc.import.insert.section')
          : t('dsb.doc.import.insert.end')

  const handleBack = (): void => {
    releaseOutline()
    setResult(null)
    setReviewValue(null)
    setPending(false)
    setInserting(false)
    setError('')
    setTarget('document-end')
    setCursorExpired(false)
  }

  return (
    <BaseDrawer show={show} onClose={onClose} type={TYPE.DRAWER.DOC_IMPORT} wide={!!result}>
      <LazyMotion features={domAnimation}>
        <div className={s.drawer}>
          <div className={s.header}>
            {result ? (
              <button type='button' className={s.backButton} onClick={handleBack}>
                <ArrowSimpleSVG className={s.backIcon} />
                {t('dsb.doc.import.back')}
              </button>
            ) : (
              <div className={s.titleGroup}>
                <FileTextSVG className={s.titleIcon} />
                <div className={s.title}>{t('dsb.doc.action.import_content')}</div>
              </div>
            )}
            <button
              type='button'
              className={s.closeButton}
              aria-label={t('dsb.doc.import.close')}
              onClick={onClose}
            >
              <CloseLightSVG className={s.closeIcon} />
            </button>
          </div>

          <div className={s.body}>
            {!result ? (
              <div className={s.sourceFlow}>
                <div>
                  <h3 className={s.heading}>{t('dsb.doc.import.source_title')}</h3>
                  <p className={s.description}>{t('dsb.doc.import.source_desc')}</p>
                </div>
                <div className={s.sourceList}>
                  <SourceCard
                    title={t('dsb.doc.import.source.local')}
                    description={t('dsb.doc.import.source.local_desc')}
                    icon={<FileTextSVG className={s.cardIcon} />}
                    expanded={source === 'local-file'}
                    onClick={() => toggleSource('local-file')}
                  >
                    <LocalFilePicker pending={pending} onSelect={handleSelectFile} />
                  </SourceCard>
                  <SourceCard
                    title={t('dsb.doc.import.source.platform')}
                    description={t('dsb.doc.import.source.platform_desc')}
                    icon={<LinkSVG className={s.cardIcon} />}
                    expanded={source === 'documentation-platform'}
                    onClick={() => toggleSource('documentation-platform')}
                  >
                    <PlatformUrlPicker pending={pending} onSubmit={handlePlatformUrl} />
                  </SourceCard>
                  <SourceCard
                    disabled
                    badge={t('dsb.doc.import.coming_soon')}
                    title={t('dsb.doc.import.source.notion')}
                    description={t('dsb.doc.import.source.notion_desc')}
                    icon={<NotionSVG className={s.cardIcon} />}
                  />
                  <SourceCard
                    disabled
                    badge={t('dsb.doc.import.coming_soon')}
                    title={t('dsb.doc.import.source.google_docs')}
                    description={t('dsb.doc.import.source.google_docs_desc')}
                    icon={<GoogleSVG className={s.cardIcon} />}
                  />
                </div>
              </div>
            ) : (
              <div className={s.previewFlow}>
                <div className={s.previewHeader}>
                  <div>
                    <h3 className={s.heading}>{t('dsb.doc.import.preview')}</h3>
                    <p className={s.description}>{t('dsb.doc.import.preview_desc')}</p>
                  </div>
                  <div className={s.sourceMeta}>
                    <span className={s.sourceFilename}>{result.source.filename}</span>
                    <span className={s.sourceSize}>
                      {(result.source.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
                <ReviewEditor
                  key={reviewRevision}
                  defaultValue={result.value}
                  onChange={setReviewValue}
                />
              </div>
            )}

            {error ? (
              <div className={s.error} role='alert'>
                {error}
              </div>
            ) : null}
          </div>

          {result ? (
            <div className={s.footer}>
              <InsertAction
                cursorAvailable={!!cursor && !cursorExpired}
                disabled={inserting || !editor || !reviewValue}
                inserting={inserting}
                label={inserting ? t('dsb.doc.import.inserting') : insertLabel}
                outline={outline}
                sectionKey={sectionKey}
                target={target}
                onInsert={handleInsert}
                onSectionChange={setSectionKey}
                onTargetChange={setTarget}
              />
            </div>
          ) : null}
        </div>
      </LazyMotion>
    </BaseDrawer>
  )
}

export default ImportDrawer
