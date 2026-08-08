import { useCallback, useMemo, useState } from 'react'

import SIZE from '~/const/size'
import useTrans from '~/hooks/useTrans'
import Button from '~/ui/Buttons/Button'
import { MARKDOWN_PLATFORMS } from '~/unit/DashboardThread/CMS/Docs/markdown_platforms'

import useSalon from './salon/review_step'
import SourceTree from './SourceTree'
import { pageIdsFromTabs, pageMetaFromSourceTree } from './sourceTreeSelection'
import type { TDocImportPreview } from './spec'

/** Renders validated target structure, selection, warnings, and the single apply confirmation. */
export default function ReviewStep({
  apply,
  preview,
  reset,
}: {
  apply: (selectedSourceIds: string[]) => Promise<void>
  preview: TDocImportPreview
  reset: () => Promise<boolean>
}) {
  const s = useSalon()
  const { t } = useTrans()
  const [resetting, setResetting] = useState(false)
  const info = preview.sourceInfo
  const platform = MARKDOWN_PLATFORMS.find(
    ({ text }) => text.toLowerCase() === info.framework.toLowerCase(),
  )
  const frameworkLabel = platform?.text || info.framework || 'Markdown'
  const pageMeta = useMemo(
    () => pageMetaFromSourceTree(preview.tree.navigation),
    [preview.tree.navigation],
  )
  const allPageIds = useMemo(
    () => pageIdsFromTabs(preview.targetTree.tabs || []),
    [preview.targetTree.tabs],
  )
  const navigationPageIds = useMemo(
    () =>
      allPageIds.filter((sourceId) => {
        const metadata = pageMeta.get(sourceId)
        return !metadata?.draft && metadata?.navigationStatus !== 'unlisted'
      }),
    [allPageIds, pageMeta],
  )
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(
    () => new Set(allPageIds.filter((sourceId) => !pageMeta.get(sourceId)?.draft)),
  )

  const toggleSelection = useCallback((sourceIds: string[], checked: boolean): void => {
    setSelectedSourceIds((current) => {
      const next = new Set(current)
      for (const sourceId of sourceIds) {
        if (checked) next.add(sourceId)
        else next.delete(sourceId)
      }
      return next
    })
  }, [])

  const restart = async (): Promise<void> => {
    setResetting(true)
    await reset()
    setResetting(false)
  }

  return (
    <section className={s.wrapper}>
      <div className={s.card}>
        <div className={s.header}>
          <div>
            <h2 className={s.title}>{t('dsb.doc.bulk_import.review.detected')}</h2>
            <a className={s.repoLink} href={info.repoUrl} target='_blank' rel='noreferrer'>
              {info.repo}
            </a>
          </div>
          <span className={s.badge}>
            {platform && <img aria-hidden alt='' className={s.badgeLogo} src={platform.logoSrc} />}
            <span>{frameworkLabel}</span>
          </span>
        </div>
        <dl className={s.infoGrid}>
          <div>
            <dt className={s.infoTerm}>{t('dsb.doc.bulk_import.info.branch')}</dt>
            <dd className={s.infoValue}>{info.branch}</dd>
          </div>
          <div>
            <dt className={s.infoTerm}>Commit</dt>
            <dd className={s.infoValue}>{info.commit?.slice(0, 8) || '—'}</dd>
          </div>
          <div>
            <dt className={s.infoTerm}>{t('dsb.doc.bulk_import.info.content_root')}</dt>
            <dd className={s.infoValue}>{info.contentRoot || '/'}</dd>
          </div>
          <div>
            <dt className={s.infoTerm}>{t('dsb.doc.bulk_import.info.config')}</dt>
            <dd className={s.infoValue}>{info.configPaths.join(', ') || '—'}</dd>
          </div>
        </dl>
        <div className={s.countsDivider} />
        <div className={s.counts}>
          <span>
            <b className={s.countValue}>{preview.counts.tabs}</b> Tabs
          </span>
          <span>
            <b className={s.countValue}>{preview.counts.groups}</b> Groups
          </span>
          <span>
            <b className={s.countValue}>{preview.counts.pages}</b> Pages
          </span>
          <span>
            <b className={s.countValue}>{preview.counts.links}</b> Links
          </span>
        </div>
      </div>

      <div className={s.card}>
        <h3 className={s.title}>{t('dsb.doc.bulk_import.review.tree')}</h3>
        <p className={s.description}>{t('dsb.doc.bulk_import.review.mapping')}</p>
        <div className={s.selectionBar}>
          <span className={s.selectionCount}>
            <b>{selectedSourceIds.size}</b> {t('dsb.doc.bulk_import.review.selected_of')}{' '}
            <b>{allPageIds.length}</b>
          </span>
          <div className={s.selectionActions}>
            <Button
              ghost
              noBorder
              size={SIZE.SMALL}
              onClick={() => setSelectedSourceIds(new Set(allPageIds))}
            >
              {t('dsb.doc.bulk_import.review.select_all')}
            </Button>
            <Button
              ghost
              noBorder
              size={SIZE.SMALL}
              onClick={() => setSelectedSourceIds(new Set(navigationPageIds))}
            >
              {t('dsb.doc.bulk_import.review.navigation_only')}
            </Button>
          </div>
        </div>
        <SourceTree
          pageMeta={pageMeta}
          selectedSourceIds={selectedSourceIds}
          tabs={preview.targetTree.tabs || []}
          onToggle={toggleSelection}
        />
        {selectedSourceIds.size === 0 ? (
          <p className={s.selectionError}>{t('dsb.doc.bulk_import.review.selection_required')}</p>
        ) : null}
        <div className={s.actions}>
          <Button ghost noBorder loading={resetting} onClick={() => void restart()}>
            {t('dsb.doc.bulk_import.review.restart')}
          </Button>
          <Button
            disabled={selectedSourceIds.size === 0}
            onClick={() => void apply(Array.from(selectedSourceIds))}
          >
            {t('dsb.doc.bulk_import.review.confirm')} ({selectedSourceIds.size})
          </Button>
        </div>
      </div>
    </section>
  )
}
