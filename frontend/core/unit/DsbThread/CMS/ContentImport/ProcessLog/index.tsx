import useTrans from '~/hooks/useTrans'
import type { TTransKey } from '~/spec'

import ProcessStep from './ProcessStep'
import RecentBatch from './RecentBatch'
import useSalon from './salon'
import type { TImportProcess, TImportProcessStage } from './spec'

const PREVIEW_STAGES: TImportProcessStage[] = ['analyzing', 'building_preview']
const JOB_STAGES: TImportProcessStage[] = ['preparing', 'applying']

const STAGE_LABELS: Record<TImportProcessStage, TTransKey> = {
  analyzing: 'dsb.content_import.process.analyzing',
  applying: 'dsb.content_import.process.applying',
  building_preview: 'dsb.content_import.process.building_preview',
  preparing: 'dsb.content_import.process.preparing',
}

const STAGE_DETAILS: Record<TImportProcessStage, TTransKey[]> = {
  analyzing: [
    'dsb.content_import.process.analyzing_read',
    'dsb.content_import.process.analyzing_detect',
    'dsb.content_import.process.analyzing_parse',
  ],
  applying: [
    'dsb.content_import.process.applying_write',
    'dsb.content_import.process.applying_finalize',
  ],
  building_preview: [
    'dsb.content_import.process.preview_validate',
    'dsb.content_import.process.preview_assemble',
  ],
  preparing: [
    'dsb.content_import.process.preparing_convert',
    'dsb.content_import.process.preparing_stage',
    'dsb.content_import.process.preparing_track',
  ],
}

type TProps = {
  disconnected?: boolean
  process: TImportProcess
}

/**
 * Renders Preview or Job process stages from the shared process contract.
 *
 * @see docs/bulk-import/import-process-log.md
 */
export default function ImportProcessLog({ disconnected = false, process }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const stages = PREVIEW_STAGES.includes(process.stage) ? PREVIEW_STAGES : JOB_STAGES
  const currentIndex = stages.indexOf(process.stage)
  const currentLabel = t(STAGE_LABELS[process.stage])

  return (
    <section className={s.wrapper}>
      <div className={s.divider} aria-hidden />
      <div className={s.content}>
        <span className={s.stageLive} role='status' aria-live='polite'>
          {currentLabel}
        </span>
        <ol className={s.steps}>
          {stages.map((stage, index) => {
            const isCurrent = index === currentIndex
            const status =
              index < currentIndex || (isCurrent && process.state === 'completed')
                ? 'completed'
                : isCurrent && process.state === 'failed'
                  ? 'failed'
                  : isCurrent
                    ? 'active'
                    : 'pending'

            return (
              <ProcessStep
                key={stage}
                details={STAGE_DETAILS[stage].map((key) => t(key))}
                label={t(STAGE_LABELS[stage])}
                status={status}
              />
            )
          })}
        </ol>

        {process.progress ? (
          <div className={s.progress}>
            <span className={s.progressLabel}>{t('dsb.content_import.process.progress')}</span>
            <span className={s.progressCount}>
              {process.progress.completed}
              {process.progress.total === undefined ? null : ` / ${process.progress.total}`}
            </span>
          </div>
        ) : null}

        <RecentBatch items={process.recentBatch} />

        {disconnected ? (
          <p className={s.disconnected} role='status'>
            {t('dsb.content_import.process.reconnecting')}
          </p>
        ) : null}
      </div>
      <div className={s.bottomDivider} aria-hidden />
    </section>
  )
}
